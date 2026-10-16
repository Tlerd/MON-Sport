import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';

const respond = (body: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(body) }));

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows that the API and the database run', async () => {
    respond({ status: 'ok', db: 'up' });
    render(<App />);
    expect(await screen.findByText('Máy chủ và cơ sở dữ liệu đang chạy')).toBeTruthy();
  });

  it('shows an error when the API does not answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<App />);
    expect(await screen.findByText('Không kết nối được máy chủ hoặc cơ sở dữ liệu')).toBeTruthy();
  });
});
