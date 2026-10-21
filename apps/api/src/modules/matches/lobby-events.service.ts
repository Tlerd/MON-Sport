import { Injectable, type MessageEvent, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import pg from 'pg';
import { interval, map, merge, Observable, startWith, Subject } from 'rxjs';

const PING_INTERVAL_MS = 25_000;
const RECONNECT_DELAY_MS = 1_000;
// Each client holds one Cloud Run request slot while it listens. The cap keeps slots free for booking requests:
// the service runs with --concurrency=60 (docs/deploy-gcp.md), so 40 streams leave 20 slots for the API.
const DEFAULT_MAX_STREAMS = 40;
const RETRY_WHEN_FULL_MS = 30_000;
const RETRY_WHEN_OPEN_MS = 3_000;

function maxStreams(): number {
  const value = Number(process.env.LOBBY_STREAM_MAX);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MAX_STREAMS;
}

/**
 * Brief F-012 (UC-8, AC-9, ADR 0004): one dedicated PostgreSQL `LISTEN lobby` connection per API instance.
 * Every committed INSERT or UPDATE OF status, joinedCount on `Match` triggers `pg_notify('lobby', id)`
 * and reaches every connected SSE client on every Cloud Run instance.
 */
@Injectable()
export class LobbyEvents implements OnModuleInit, OnModuleDestroy {
  private readonly events = new Subject<MessageEvent>();
  private client: pg.Client | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private open = 0;

  async onModuleInit(): Promise<void> {
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
    this.events.complete();
  }

  /**
   * A slot is held from subscribe to unsubscribe. The cap is checked and the count raised in the same synchronous step,
   * so parallel requests cannot pass it together. Past the cap the client gets one ping with `retry` and the stream ends.
   * EventSource then connects again after that time. A 503 would stop it for good, and the viewer would lose live updates.
   */
  stream(): Observable<MessageEvent> {
    // EventSource keeps the last `retry` it saw. The first ping of an admitted client resets it to a short time, so a viewer
    // that was refused once does not wait 30 seconds after each cut of the stream (Cloud Run ends a request after 300 seconds).
    const pings = interval(PING_INTERVAL_MS).pipe(
      startWith(0),
      map((_, index): MessageEvent => (index === 0 ? { type: 'ping', data: '', retry: RETRY_WHEN_OPEN_MS } : { type: 'ping', data: '' })),
    );
    const merged = merge(pings, this.events.asObservable());
    return new Observable<MessageEvent>((subscriber) => {
      if (this.open >= maxStreams()) {
        subscriber.next({ type: 'ping', data: '', retry: RETRY_WHEN_FULL_MS });
        subscriber.complete();
        return undefined;
      }
      this.open++;
      const inner = merged.subscribe(subscriber);
      return () => {
        this.open--;
        inner.unsubscribe();
      };
    });
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    this.client = client;
    client.on('notification', (msg) => {
      if (msg.channel === 'lobby' && msg.payload) {
        this.events.next({ type: 'match', data: { id: msg.payload } });
      }
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
      await client.query('LISTEN lobby');
    } catch {
      scheduleReconnect();
    }
  }
}
