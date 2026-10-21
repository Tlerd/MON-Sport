import type { MessageEvent } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { LobbyEvents } from './lobby-events.service.js';

// Each SSE client holds one Cloud Run request slot while it listens, so a cap per instance keeps slots free for the API.
// A client past the cap gets one ping that tells the browser to retry later, and the stream ends. A 503 would stop EventSource for good.
// An admitted client is told a short retry on its first ping. EventSource keeps the last `retry` it saw, so a viewer that was
// refused once would otherwise wait 30 seconds after every cut of the stream.
const RETRY_MS = 30_000;
const RETRY_OPEN_MS = 3_000;

function listen(lobby: LobbyEvents) {
  const events: MessageEvent[] = [];
  const state = { completed: false };
  const subscription = lobby.stream().subscribe({
    next: (event) => events.push(event),
    complete: () => {
      state.completed = true;
    },
  });
  return { events, state, subscription };
}

const admitted = (client: ReturnType<typeof listen>) =>
  !client.state.completed && client.events.length >= 1 && client.events[0].retry === RETRY_OPEN_MS && client.events.slice(1).every((event) => event.retry === undefined);
const refused = (client: ReturnType<typeof listen>) => client.state.completed && client.events.length === 1 && client.events[0].retry === RETRY_MS;

describe('lobby SSE cap', () => {
  afterEach(() => {
    delete process.env.LOBBY_STREAM_MAX;
  });

  it('ends a stream past the cap with one retry ping, and a client that leaves frees its slot', () => {
    process.env.LOBBY_STREAM_MAX = '2';
    const lobby = new LobbyEvents();
    const first = listen(lobby);
    const second = listen(lobby);
    const third = listen(lobby);
    expect(admitted(first)).toBe(true);
    expect(admitted(second)).toBe(true);
    expect(refused(third)).toBe(true);
    first.subscription.unsubscribe();
    const fourth = listen(lobby);
    expect(admitted(fourth)).toBe(true);
    expect(refused(listen(lobby))).toBe(true);
    for (const client of [second, fourth]) client.subscription.unsubscribe();
  });

  it('does not count a refused client, so its end frees no slot it never held', () => {
    process.env.LOBBY_STREAM_MAX = '1';
    const lobby = new LobbyEvents();
    const holder = listen(lobby);
    for (let i = 0; i < 3; i++) expect(refused(listen(lobby))).toBe(true);
    expect(refused(listen(lobby))).toBe(true);
    holder.subscription.unsubscribe();
    const next = listen(lobby);
    expect(admitted(next)).toBe(true);
    expect(refused(listen(lobby))).toBe(true);
    next.subscription.unsubscribe();
  });

  it('counts a stream only after a client subscribes, so a stream that nobody opens holds no slot', () => {
    process.env.LOBBY_STREAM_MAX = '1';
    const lobby = new LobbyEvents();
    lobby.stream();
    lobby.stream();
    const only = listen(lobby);
    expect(admitted(only)).toBe(true);
    only.subscription.unsubscribe();
  });

  it('allows 40 streams when the variable is unset or not a positive integer', () => {
    for (const value of [undefined, '', 'abc', '0', '-3', '1.5']) {
      if (value === undefined) delete process.env.LOBBY_STREAM_MAX;
      else process.env.LOBBY_STREAM_MAX = value;
      const lobby = new LobbyEvents();
      const open = Array.from({ length: 40 }, () => listen(lobby));
      expect(open.every(admitted)).toBe(true);
      expect(refused(listen(lobby))).toBe(true);
      for (const client of open) client.subscription.unsubscribe();
    }
  });
});
