import { Injectable, type MessageEvent, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import pg from 'pg';
import { interval, map, merge, type Observable, startWith, Subject } from 'rxjs';

const PING_INTERVAL_MS = 25_000;
const RECONNECT_DELAY_MS = 1_000;

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

  stream(): Observable<MessageEvent> {
    const pings = interval(PING_INTERVAL_MS).pipe(
      startWith(0),
      map((): MessageEvent => ({ type: 'ping', data: '' })),
    );
    return merge(pings, this.events.asObservable());
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
