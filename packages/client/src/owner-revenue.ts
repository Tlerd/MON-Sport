import {
  addDaysYmd,
  type BookingStatus,
  type FinancialPeriod,
  vnDateString,
  vnWeekRange,
} from '@monsport/shared';
import { dayHeading, slotAt } from './booking.ts';

export interface PeriodHeadingView {
  period: FinancialPeriod;
  date?: string;
  startDate?: string;
  endDate?: string;
}

export function shiftPeriodDate(date: string, period: FinancialPeriod, steps: number): string {
  if (period === 'day') return addDaysYmd(date, steps);
  if (period === 'week') return addDaysYmd(date, steps * 7);
  const [y, m, d] = date.split('-').map(Number);
  const targetFirst = new Date(Date.UTC(y!, m! - 1 + steps, 1));
  const targetYear = targetFirst.getUTCFullYear();
  const targetMonth = targetFirst.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const clampedDay = Math.min(d!, lastDay);
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function periodHeading(view: PeriodHeadingView): string {
  if (view.period === 'week') {
    const startYmd =
      view.startDate && view.endDate
        ? vnDateString(new Date(view.startDate))
        : vnWeekRange(view.date ?? '').weekStart;
    const endYmd =
      view.startDate && view.endDate
        ? vnDateString(new Date(view.endDate))
        : vnWeekRange(view.date ?? '').weekEnd;
    const [, sm, sd] = startYmd.split('-');
    const [ey, em, ed] = endYmd.split('-');
    return `Tuần ${sd}/${sm}–${ed}/${em}/${ey}`;
  }
  const ymd = view.date ?? vnDateString(new Date(view.startDate!));
  if (view.period === 'day') return dayHeading(ymd);
  const [y, m] = ymd.split('-');
  return `Tháng ${m}/${y}`;
}

export function unpaidInPeriod<
  T extends { status: BookingStatus; paidAtVenue: boolean; startAt: string; courtId: string },
>(bookings: readonly T[], startDate: string, endDate: string, courtIds: readonly string[]): T[] {
  const from = Date.parse(startDate);
  const to = Date.parse(endDate);
  const courts = new Set(courtIds);
  return bookings
    .filter((b) => {
      if (b.status !== 'CONFIRMED' || b.paidAtVenue !== false || !courts.has(b.courtId)) {
        return false;
      }
      const startAt = Date.parse(b.startAt);
      return from <= startAt && startAt <= to;
    })
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
}

export function percent(rate: number): string {
  if (rate > 0 && rate < 0.005) return '<1%';
  return `${Math.round(rate * 100)}%`;
}

export function periodRange(
  period: FinancialPeriod,
  date: string,
): { startDate: string; endDate: string } {
  let first = date;
  let last = date;
  if (period === 'week') {
    const week = vnWeekRange(date);
    first = week.weekStart;
    last = week.weekEnd;
  } else if (period === 'month') {
    const [y, m] = date.split('-').map(Number);
    first = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
    last = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }
  return {
    startDate: new Date(slotAt(first, 0)).toISOString(),
    endDate: new Date(Date.parse(slotAt(last, 1440)) - 1).toISOString(),
  };
}
