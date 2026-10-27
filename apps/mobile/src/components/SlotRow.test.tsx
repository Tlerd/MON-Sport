import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SlotRow } from './SlotRow';

const noop = () => {};

describe('SlotRow', () => {
  afterEach(cleanup);

  it('AC-8: renders 34 cells from 06:00 to 22:30, with buttons only for startable cells', () => {
    render(
      <SlotRow courtId="c1" courtName="Sân 1" opensAt={360} closesAt={1380} startable={[1080, 1110]} selected={1110} onPick={noop} />,
    );
    const cells = Array.from(document.querySelectorAll<HTMLElement>('.slot-cell'));
    expect(cells).toHaveLength(34);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(cells.filter((c) => c.getAttribute('aria-disabled') === 'true')).toHaveLength(32);
    expect(document.querySelector('.slot-selected')?.getAttribute('data-minute')).toBe('1110');
  });

  it('AC-8: marks the cells from 17:00 to 21:30 as peak, and puts a label above every second cell', () => {
    render(<SlotRow courtId="c1" courtName="Sân 1" opensAt={360} closesAt={1380} startable={[]} onPick={noop} />);
    expect(document.querySelectorAll('.peak-marker')).toHaveLength(10);
    const labels = Array.from(document.querySelectorAll('.slot-hour')).map((l) => l.textContent);
    expect(labels.filter(Boolean)).toHaveLength(17);
    expect(labels[0]).toBe('06:00');
    expect(labels[1]).toBe('');
  });
});
