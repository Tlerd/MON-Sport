import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SlotGrid } from './SlotGrid.tsx';

describe('SlotGrid', () => {
  afterEach(() => {
    cleanup();
  });
  const courts = [
    { id: 'c1', name: 'Sân 1' },
    { id: 'c2', name: 'Sân 2' },
  ];

  it('free cell calls onPick', () => {
    const onPick = vi.fn();
    render(
      <SlotGrid
        courts={courts}
        date="2026-10-24"
        now={new Date('2026-10-23T03:00:00Z')}
        onPick={onPick}
        opensAt={360}
        closesAt={480}
      />,
    );

    const freeCell = screen.getByLabelText('Sân 1 06:00 trống');
    expect(freeCell).toBeTruthy();
    expect((freeCell as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(freeCell);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith('c1', 360, expect.anything());
  });

  it('taken cell is disabled', () => {
    const onPick = vi.fn();
    const cells = {
      c1: [{ startMinute: 360, status: 'taken' as const }],
    };

    render(
      <SlotGrid
        courts={courts}
        cells={cells}
        mode="pick"
        onPick={onPick}
        opensAt={360}
        closesAt={480}
      />,
    );

    const takenCell = screen.getByLabelText('Sân 1 06:00 đã có người') as HTMLButtonElement;
    expect(takenCell.disabled).toBe(true);

    fireEvent.click(takenCell);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('peak cells carry the class', () => {
    render(
      <SlotGrid
        courts={courts}
        opensAt={16 * 60} // 16:00
        closesAt={18 * 60} // 18:00
      />,
    );

    // 16:00 (960 min) is NOT peak. It is in the Chiều window.
    fireEvent.click(screen.getByRole('button', { name: /^Chiều/ }));
    const normalCell = screen.getByLabelText('Sân 1 16:00 trống');
    expect(normalCell.classList.contains('peak')).toBe(false);

    // 17:00 (1020 min) and 17:30 (1050 min) ARE peak. They are in the Tối window.
    fireEvent.click(screen.getByRole('button', { name: /^Tối/ }));
    const peakCell1 = screen.getByLabelText('Sân 1 17:00 trống');
    const peakCell2 = screen.getByLabelText('Sân 1 17:30 trống');
    expect(peakCell1.classList.contains('peak')).toBe(true);
    expect(peakCell2.classList.contains('peak')).toBe(true);
  });

  it('arrow keys move focus', () => {
    render(
      <SlotGrid
        courts={courts}
        opensAt={360}
        closesAt={480}
      />,
    );

    const cell1 = screen.getByLabelText('Sân 1 06:00 trống');
    const cellRight = screen.getByLabelText('Sân 1 06:30 trống');
    const cellDown = screen.getByLabelText('Sân 2 06:30 trống');

    cell1.focus();
    expect(document.activeElement).toBe(cell1);

    // ArrowRight moves focus to the next cell in the row
    fireEvent.keyDown(cell1, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(cellRight);

    // ArrowDown moves focus to the cell in the court below
    fireEvent.keyDown(cellRight, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cellDown);

    // ArrowUp moves focus back up
    fireEvent.keyDown(cellDown, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(cellRight);

    // ArrowLeft moves focus back left
    fireEvent.keyDown(cellRight, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(cell1);
  });

  describe('time windows (DESIGN.md)', () => {
    // 2026-10-23 14:10 in Asia/Ho_Chi_Minh.
    const now = new Date('2026-10-23T07:10:00Z');
    const cellsOf = () => screen.getAllByRole('button', { name: /^Sân 1 / });

    it('splits 06:00–23:00 into Sáng, Chiều, Tối, and shows at most 12 cells per court', () => {
      render(<SlotGrid courts={courts} date="2026-10-24" now={now} />);
      expect(screen.getByRole('button', { name: /^Sáng 06–12/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Chiều 12–17/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Tối 17–23/ })).toBeTruthy();
      expect(cellsOf().length).toBeLessThanOrEqual(12);
    });

    it('opens on Tối for another day, and on the current window for today', () => {
      render(<SlotGrid courts={courts} date="2026-10-24" now={now} />);
      expect(screen.getByRole('button', { name: /^Tối/ }).getAttribute('aria-pressed')).toBe('true');
      cleanup();
      render(<SlotGrid courts={courts} date="2026-10-23" now={now} />);
      expect(screen.getByRole('button', { name: /^Chiều/ }).getAttribute('aria-pressed')).toBe('true');
    });

    it('disables the cells of today before the current time', () => {
      render(<SlotGrid courts={courts} date="2026-10-23" now={now} />);
      expect((screen.getByLabelText('Sân 1 13:30 đã qua') as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByLabelText('Sân 1 14:30 trống') as HTMLButtonElement).disabled).toBe(false);
    });

    it('AC-1: another day shows the 3 windows and only the cells of one window', () => {
      render(<SlotGrid courts={courts} date="2026-11-21" now={new Date('2026-11-20T03:33:00Z')} />);
      expect(screen.getByRole('button', { name: /^Sáng 06–12/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Chiều 12–17/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Tối 17–23/ })).toBeTruthy();
      // Tối 17:00–23:00 is 12 half hours, and no cell of another window is shown.
      expect(cellsOf().length).toBe(12);
      expect(screen.queryByLabelText(/^Sân 1 16:30/)).toBeNull();
      expect(screen.getByLabelText(/^Sân 1 17:00/)).toBeTruthy();
    });

    it('AC-2: today at 10:33 (Asia/Ho_Chi_Minh) opens Sáng, locks 06:00 to 10:30, and 11:00 is free', () => {
      render(<SlotGrid courts={courts} date="2026-11-20" now={new Date('2026-11-20T03:33:00Z')} />);
      expect(screen.getByRole('button', { name: /^Sáng/ }).getAttribute('aria-pressed')).toBe('true');
      for (const t of ['06:00', '08:30', '10:00', '10:30']) {
        expect((screen.getByLabelText(`Sân 1 ${t} đã qua`) as HTMLButtonElement).disabled).toBe(true);
      }
      expect((screen.getByLabelText('Sân 1 11:00 trống') as HTMLButtonElement).disabled).toBe(false);
    });

    it('a chip switches the window and counts its free hours across courts', () => {
      const cells = { c1: [{ startMinute: 360, status: 'taken' as const }] };
      render(<SlotGrid courts={courts} cells={cells} date="2026-10-24" now={now} />);
      const morning = screen.getByRole('button', { name: /^Sáng/ });
      // 2 courts x 12 cells, minus 1 taken cell = 23 half hours.
      expect(morning.textContent).toContain('11,5 giờ trống');
      fireEvent.click(morning);
      expect(screen.getByLabelText('Sân 1 06:00 đã có người')).toBeTruthy();
    });

    it('in manage mode, a chip counts the pending requests of its window', () => {
      const cells = {
        c1: [
          { startMinute: 1200, status: 'pending' as const, bookingId: 'b1' },
          { startMinute: 1230, status: 'pending' as const, bookingId: 'b1' },
        ],
        c2: [{ startMinute: 1140, status: 'pending' as const, bookingId: 'b2' }],
      };
      render(<SlotGrid courts={courts} cells={cells} mode="manage" date="2026-10-24" now={now} />);
      expect(screen.getByRole('button', { name: /^Tối/ }).textContent).toContain('2 chờ');
      expect(screen.getByRole('button', { name: /^Sáng/ }).textContent).not.toContain('chờ');
    });

    it('keeps one window when the opening hours fit in it', () => {
      render(<SlotGrid courts={courts} opensAt={360} closesAt={480} />);
      expect(screen.queryByRole('group', { name: 'Buổi' })).toBeNull();
    });

    it('the chip aria-label holds the count', () => {
      render(<SlotGrid courts={courts} date="2026-10-24" now={now} />);
      const morning = screen.getByRole('button', { name: /^Sáng 06–12/ });
      expect(morning.getAttribute('aria-label')).toBe('Sáng 06–12, 12 giờ trống');
    });

    it('wraps the slot grid in a dedicated scroll container to scroll inside its own box', () => {
      const { container } = render(<SlotGrid courts={courts} date="2026-10-24" now={now} />);
      const scrollBox = container.querySelector('.slot-grid-scroll');
      const grid = container.querySelector('.slot-grid');
      expect(scrollBox).toBeTruthy();
      expect(grid).toBeTruthy();
      expect(scrollBox!.contains(grid)).toBe(true);
    });

    it('with opensAt 390, the "07:00" label sits above the 07:00 cell column', () => {
      const { container } = render(<SlotGrid courts={courts} opensAt={390} closesAt={480} />);
      const headers = container.querySelectorAll('.slot-grid-h');
      // The leading 06:30 column gets an empty header cell.
      expect(headers[0].textContent).toBe('');
      // "07:00" header cell is the second header cell, spanning 2 columns (07:00 and 07:30).
      expect(headers[1].textContent).toBe('07:00');
      expect((headers[1] as HTMLElement).style.gridColumn).toBe('span 2');
    });

    it('gives an hour label a span equal to its columns when the window ends on :30', () => {
      const { container } = render(<SlotGrid courts={courts} opensAt={360} closesAt={450} />);
      const headers = container.querySelectorAll('.slot-grid-h');
      // 06:00 has 06:00 and 06:30 -> span 2
      expect(headers[0].textContent).toBe('06:00');
      expect((headers[0] as HTMLElement).style.gridColumn).toBe('span 2');
      // 07:00 only has 07:00 before 450 (07:30) -> span 1
      expect(headers[1].textContent).toBe('07:00');
      expect((headers[1] as HTMLElement).style.gridColumn).toBe('span 1');
    });
  });
});
