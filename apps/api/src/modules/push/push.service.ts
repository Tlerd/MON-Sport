import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { formatNotificationContent, isAllowedPushEndpoint, type NotificationType, type PushPayload } from '@monsport/shared';
import pg from 'pg';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { isValidVapid, PushSender, type PushVapid } from './push-sender.js';

const RECONNECT_DELAY_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 10_000;
const TTL_SECONDS = 3_600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readVapid(): PushVapid | null {
  const [publicKey, privateKey, subject] = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'].map((name) => process.env[name]?.trim());
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

function timeoutMs(): number {
  const value = Number(process.env.PUSH_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

type Claimed = { userId: string; type: NotificationType; bookingId: string; matchId: string | null };

class SendTimeout extends Error {}

@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushService.name);
  private client: pg.Client | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private readonly inflight = new Set<Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly sender: PushSender,
  ) {}

  async onModuleInit(): Promise<void> {
    const vapid = readVapid();
    if (!vapid) {
      this.logger.log('Web Push is off');
      return;
    }
    if (!isValidVapid(vapid)) {
      this.logger.error('Web Push is off (invalid VAPID keys)');
      return;
    }
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const current = this.client;
    this.client = null;
    if (current) {
      await current.end().catch(() => undefined);
    }
    await this.idle();
  }

  async idle(): Promise<void> {
    while (this.inflight.size > 0) await Promise.allSettled([...this.inflight]);
  }

  async handle(id: string): Promise<void> {
    try {
      const claimed = await this.claim(id);
      if (!claimed) return;
      const user = await this.prisma.user.findUnique({ where: { id: claimed.userId }, select: { lockedAt: true, deletedAt: true } });
      if (!user || user.lockedAt !== null || user.deletedAt !== null) return;
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId: claimed.userId },
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      });
      if (subscriptions.length === 0) return;
      const vapid = readVapid();
      if (!vapid) return;
      const payload = await this.payloadFor(id, claimed);
      if (!payload) return;
      await Promise.all(subscriptions.map((subscription) => this.deliver(subscription, payload, vapid)));
    } catch (error) {
      this.logger.error(`Push handling failed (${this.describe(error)})`);
    }
  }

  private async claim(id: string): Promise<Claimed | null> {
    const rows = await this.prisma.$queryRaw<Claimed[]>`
      UPDATE "Notification" SET "pushedAt" = ${this.clock.now()}::timestamptz
      WHERE "id" = ${id}::uuid AND "pushedAt" IS NULL
      RETURNING "userId", "type"::text AS "type", "bookingId", "matchId"`;
    return rows[0] ?? null;
  }

  private async payloadFor(id: string, claimed: Claimed): Promise<PushPayload | null> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: claimed.bookingId },
      select: { startAt: true, endAt: true, court: { select: { name: true, venue: { select: { name: true } } } } },
    });
    if (!booking) return null;
    const { title, message } = formatNotificationContent({
      type: claimed.type,
      venueName: booking.court.venue.name,
      courtName: booking.court.name,
      startAt: booking.startAt,
      endAt: booking.endAt,
    });
    return { title, body: message, notificationId: id };
  }

  private async deliver(
    subscription: { id: string; endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
    vapid: PushVapid,
  ): Promise<void> {
    try {
      if (!isAllowedPushEndpoint(subscription.endpoint)) {
        this.logger.warn('Push endpoint no longer allowed, device removed');
        await this.prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
        return;
      }
      const { statusCode } = await this.withTimeout(
        this.sender.send(
          { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
          payload,
          vapid,
          { ttl: TTL_SECONDS, urgency: 'high', timeoutMs: timeoutMs() },
        ),
      );
      if (statusCode === 404 || statusCode === 410) {
        await this.prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
      } else if (statusCode < 200 || statusCode > 299) {
        this.logger.warn(`Push service answered ${statusCode}`);
      }
    } catch (error) {
      this.logger.warn(`Push send failed (${this.describe(error)})`);
    }
  }

  private async withTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SendTimeout()), timeoutMs());
    });
    try {
      return await Promise.race([work, limit]);
    } finally {
      clearTimeout(timer);
      work.catch(() => undefined);
    }
  }

  private describe(error: unknown): string {
    if (error instanceof SendTimeout) return 'timeout';
    const kind = (error as { kind?: unknown } | null)?.kind;
    if (kind === 'timeout' || kind === 'network') return kind;
    if (kind === 'invalid') return 'invalid key data';
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === 'string' ? `code ${code}` : 'unknown';
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL, application_name: 'monsport-push' });
    this.client = client;
    client.on('notification', (msg) => {
      if (msg.channel !== 'push' || !msg.payload || !UUID.test(msg.payload)) return;
      const work = this.handle(msg.payload).finally(() => this.inflight.delete(work));
      this.inflight.add(work);
    });
    const scheduleReconnect = (error?: unknown) => {
      if (this.stopped || this.client !== client) return;
      this.client = null;
      this.logger.warn(`Push listener lost, new try in ${RECONNECT_DELAY_MS} ms (${this.describe(error)})`);
      void client.end().catch(() => undefined);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        void this.connect();
      }, RECONNECT_DELAY_MS);
    };
    client.on('error', scheduleReconnect);
    client.on('end', scheduleReconnect);
    try {
      await client.connect();
      await client.query('LISTEN push');
    } catch (error) {
      scheduleReconnect(error);
    }
  }
}
