import { Injectable, type MessageEvent, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import pg from 'pg';
import { interval, map, merge, Observable, startWith, Subject } from 'rxjs';
import { ipBucket } from '../auth/throttle.service.js';

const PING_INTERVAL_MS = 25_000;
const RECONNECT_DELAY_MS = 1_000;
const DEFAULT_MAX_STREAMS = 40;
const DEFAULT_MAX_STREAMS_PER_IP = 4;
const RETRY_WHEN_FULL_MS = 30_000;
const RETRY_WHEN_OPEN_MS = 3_000;

function positiveIntEnv(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const maxStreams = () => positiveIntEnv(process.env.LOBBY_STREAM_MAX, DEFAULT_MAX_STREAMS);
const maxStreamsPerIp = () => positiveIntEnv(process.env.LOBBY_STREAM_MAX_PER_IP, DEFAULT_MAX_STREAMS_PER_IP);

@Injectable()
export class LobbyEvents implements OnModuleInit, OnModuleDestroy {
  private readonly events = new Subject<MessageEvent>();
  private client: pg.Client | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private open = 0;
  private readonly openByIp = new Map<string, number>();

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

  stream(ip?: string): Observable<MessageEvent> {
    const bucket = ipBucket(ip);
    const pings = interval(PING_INTERVAL_MS).pipe(
      startWith(0),
      map((_, index): MessageEvent => (index === 0 ? { type: 'ping', data: '', retry: RETRY_WHEN_OPEN_MS } : { type: 'ping', data: '' })),
    );
    const merged = merge(pings, this.events.asObservable());
    return new Observable<MessageEvent>((subscriber) => {
      const bucketCount = this.openByIp.get(bucket) ?? 0;
      if (this.open >= maxStreams() || bucketCount >= maxStreamsPerIp()) {
        subscriber.next({ type: 'ping', data: '', retry: RETRY_WHEN_FULL_MS });
        subscriber.complete();
        return undefined;
      }
      this.open++;
      this.openByIp.set(bucket, bucketCount + 1);
      const inner = merged.subscribe(subscriber);
      return () => {
        this.open--;
        const remaining = (this.openByIp.get(bucket) ?? 1) - 1;
        if (remaining <= 0) this.openByIp.delete(bucket);
        else this.openByIp.set(bucket, remaining);
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
