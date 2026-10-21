import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { LobbyEvents } from './lobby-events.service.js';

// Each SSE client holds one Cloud Run request slot while it listens, so a cap per instance keeps slots free for the API.
describe('lobby SSE cap', () => {
  afterEach(() => {
    delete process.env.LOBBY_STREAM_MAX;
  });

  it('refuses a stream past the cap with 503, and a client that leaves frees its slot', () => {
    process.env.LOBBY_STREAM_MAX = '2';
    const lobby = new LobbyEvents();
    const first = lobby.stream().subscribe();
    const second = lobby.stream().subscribe();
    expect(() => lobby.stream()).toThrow(ServiceUnavailableException);
    first.unsubscribe();
    const third = lobby.stream().subscribe();
    expect(() => lobby.stream()).toThrow(ServiceUnavailableException);
    for (const subscription of [second, third]) subscription.unsubscribe();
  });

  it('counts a stream only after a client subscribes, so a stream that nobody opens holds no slot', () => {
    process.env.LOBBY_STREAM_MAX = '1';
    const lobby = new LobbyEvents();
    lobby.stream();
    const only = lobby.stream().subscribe();
    only.unsubscribe();
  });

  it('allows 40 streams when the variable is unset or not a positive integer', () => {
    for (const value of [undefined, '', 'abc', '0', '-3', '1.5']) {
      if (value === undefined) delete process.env.LOBBY_STREAM_MAX;
      else process.env.LOBBY_STREAM_MAX = value;
      const lobby = new LobbyEvents();
      const open = Array.from({ length: 40 }, () => lobby.stream().subscribe());
      expect(() => lobby.stream()).toThrow(ServiceUnavailableException);
      for (const subscription of open) subscription.unsubscribe();
    }
  });
});
