import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { formatNotificationContent, isAllowedPushEndpoint, type NotificationType, type PushPayload } from '@monsport/shared';
import pg from 'pg';
import { Clock } from '../database/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { PushSender, type PushVapid } from './push-sender.js';

const RECONNECT_DELAY_MS = 1_000;
const DEFAULT_TIMEOUT_MS = 10_000;
/** Brief F-014, Assumption 12: a message that waits more than one hour is no longer useful. */
const TTL_SECONDS = 3_600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Brief F-014, Assumption 10: the feature is on only when all three variables are set. The API reads them on each use. */
function readVapid(): PushVapid | null {
  const [publicKey, privateKey, subject] = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'].map((name) => process.env[name]?.trim());
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

function timeoutMs(): number {
  const value = Number(process.env.PUSH_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS;
}

type Claimed = { userId: string; type: NotificationType; bookingId: string; matchId: string | null };

/** Thrown inside `deliver` when the push service does not answer in time. */
class SendTimeout extends Error {}

/**
 * Brief F-014 (UC-14, ADR 0005): one dedicated PostgreSQL `LISTEN push` connection per API instance. The trigger
 * `Notification_notify_push` sends the id of each new notification. Every instance receives it, and the one that wins the
 * `UPDATE ... WHERE "pushedAt" IS NULL` sends the message. Sending is best effort: an error never reaches the request that
 * wrote the notification, and a message is lost when no instance listens. Nothing here logs an endpoint, a key, or a payload.
 *
 * Lock order: `handle` runs no transaction. It updates one Notification row, then reads, then deletes one PushSubscription
 * row by id. Each statement takes one row lock only, so it cannot join a lock cycle with the booking, match, or subscribe paths.
 */
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
    if (!readVapid()) {
      this.logger.log('Web Push is off');
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

  /** Resolves when no delivery is running. Tests use it to check that something did not happen. */
  async idle(): Promise<void> {
    while (this.inflight.size > 0) await Promise.allSettled([...this.inflight]);
  }

  /**
   * Sends the notification to every device of its user. Never throws. Brief F-014, Assumptions 6 to 9.
   * A row that another instance claimed, or that has no device, ends here without a message.
   */
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

  /** Wins the row for this instance. No row back means another instance has it, or the id is unknown. */
  private async claim(id: string): Promise<Claimed | null> {
    const rows = await this.prisma.$queryRaw<Claimed[]>`
      UPDATE "Notification" SET "pushedAt" = ${this.clock.now()}::timestamptz
      WHERE "id" = ${id}::uuid AND "pushedAt" IS NULL
      RETURNING "userId", "type"::text AS "type", "bookingId", "matchId"`;
    return rows[0] ?? null;
  }

  /** The same title and text as the list in the app (`NotificationsService.listForUser`). It holds no name and no phone (BR-20). */
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

  /** Sends to one device. 404 and 410 mean the device is gone, so the row goes too. Any other failure keeps it. */
  private async deliver(
    subscription: { id: string; endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
    vapid: PushVapid,
  ): Promise<void> {
    try {
      // The endpoint is checked again before the network call: a row from before a rule change, or from a direct write, must not be called.
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

  /** The sender should honour the timeout, and this race makes sure that a stuck sender cannot hold the delivery. */
  private async withTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new SendTimeout()), timeoutMs());
    });
    try {
      return await Promise.race([work, limit]);
    } finally {
      clearTimeout(timer);
      // A late rejection of the sender after the race must not become an unhandled rejection.
      work.catch(() => undefined);
    }
  }

  /** A short label for the log. An error text can hold the query arguments or the endpoint, so the text stays out. */
  private describe(error: unknown): string {
    if (error instanceof SendTimeout) return 'timeout';
    const kind = (error as { kind?: unknown } | null)?.kind;
    if (kind === 'timeout' || kind === 'network') return kind;
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
    const scheduleReconnect = () => {
      if (this.stopped || this.client !== client) return;
      this.client = null;
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
    } catch {
      scheduleReconnect();
    }
  }
}
