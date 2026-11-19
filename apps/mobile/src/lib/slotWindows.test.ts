import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  firstWindow,
  handleSlotCellKeyDown,
  nearestMinute,
  shortTime,
  windowsFor,
} from './slotWindows.ts';

describe('slotWindows', () => {
  let containers: HTMLElement[] = [];

  afterEach(() => {
    for (const el of containers) el.remove();
    containers = [];
  });

  it('clips windowsFor to open hours and drops windows under 30 minutes', () => {
    expect(windowsFor(360, 1380)).toEqual([
      { id: 'sang', name: 'Sáng', from: 360, to: 720 },
      { id: 'chieu', name: 'Chiều', from: 720, to: 1020 },
      { id: 'toi', name: 'Tối', from: 1020, to: 1380 },
    ]);

    expect(windowsFor(700, 1030)).toEqual([{ id: 'chieu', name: 'Chiều', from: 720, to: 1020 }]);
    expect(windowsFor(690, 1050)).toEqual([
      { id: 'sang', name: 'Sáng', from: 690, to: 720 },
      { id: 'chieu', name: 'Chiều', from: 720, to: 1020 },
      { id: 'toi', name: 'Tối', from: 1020, to: 1050 },
    ]);
  });

  it('firstWindow picks the current window today and falls back to toi or the first window on other dates', () => {
    const all = windowsFor(360, 1380);
    expect(firstWindow(all, '2026-11-06', new Date('2026-11-06T09:00:00+07:00'))).toBe('sang');
    expect(firstWindow(all, '2026-11-06', new Date('2026-11-06T14:00:00+07:00'))).toBe('chieu');
    expect(firstWindow(all, '2026-11-06', new Date('2026-11-06T19:00:00+07:00'))).toBe('toi');
    expect(firstWindow(all, '2026-11-06', new Date('2026-11-06T23:30:00+07:00'))).toBe('toi');

    expect(firstWindow(all, '2026-11-07', new Date('2026-11-06T09:00:00+07:00'))).toBe('toi');
    const daytimeOnly = windowsFor(360, 1020);
    expect(firstWindow(daytimeOnly, '2026-11-07', new Date('2026-11-06T09:00:00+07:00'))).toBe('sang');
    expect(firstWindow([], '2026-11-07', new Date('2026-11-06T09:00:00+07:00'))).toBeUndefined();
  });

  it('shortTime formats whole hours without minutes and half hours with padded minutes', () => {
    expect(shortTime(360)).toBe('6');
    expect(shortTime(390)).toBe('6:30');
    expect(shortTime(1020)).toBe('17');
    expect(shortTime(1350)).toBe('22:30');
    expect(shortTime(365)).toBe('6:05');
  });

  it('nearestMinute returns undefined for an empty list and prefers the earlier minute on a tie', () => {
    expect(nearestMinute([], 1050)).toBeUndefined();
    expect(nearestMinute([1020, 1080], 1050)).toBe(1020);
    expect(nearestMinute([900, 1020, 1080], 1060)).toBe(1080);
  });

  it('handleSlotCellKeyDown moves focus on arrow keys, skips courts with no startable slots, and ignores other keys', () => {
    const courts = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
    const startable: Record<string, number[]> = {
      c1: [960, 990, 1050],
      c2: [],
      c3: [960, 1020],
    };
    const startableOf = (c: { id: string }) => startable[c.id] ?? [];

    const root = document.createElement('div');
    for (const c of courts) {
      const row = document.createElement('div');
      row.setAttribute('data-court-id', c.id);
      for (const m of startableOf(c)) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-minute', String(m));
        row.appendChild(btn);
      }
      root.appendChild(row);
    }
    document.body.appendChild(root);
    containers.push(root);

    const btn = (courtId: string, minute: number) =>
      root.querySelector<HTMLButtonElement>(`[data-court-id="${courtId}"] button[data-minute="${minute}"]`)!;

    btn('c1', 960).focus();
    const rightEvent = { key: 'ArrowRight', preventDefault: vi.fn() };
    handleSlotCellKeyDown(rightEvent, courts, startableOf, 0, 960);
    expect(rightEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(btn('c1', 990));

    const leftEvent = { key: 'ArrowLeft', preventDefault: vi.fn() };
    handleSlotCellKeyDown(leftEvent, courts, startableOf, 0, 990);
    expect(leftEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(btn('c1', 960));

    const downEvent = { key: 'ArrowDown', preventDefault: vi.fn() };
    handleSlotCellKeyDown(downEvent, courts, startableOf, 0, 990);
    expect(downEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(btn('c3', 960));

    const upEvent = { key: 'ArrowUp', preventDefault: vi.fn() };
    handleSlotCellKeyDown(upEvent, courts, startableOf, 2, 1020);
    expect(upEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(btn('c1', 990));

    const enterEvent = { key: 'Enter', preventDefault: vi.fn() };
    handleSlotCellKeyDown(enterEvent, courts, startableOf, 0, 990);
    expect(enterEvent.preventDefault).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(btn('c1', 990));
  });
});
