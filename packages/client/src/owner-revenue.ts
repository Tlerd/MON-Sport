import { addDaysYmd, type FinancialPeriod, vnDateString, vnWeekRange } from '@monsport/shared';
import { dayHeading } from './booking.ts';

export interface PeriodHeadingView {
  period: FinancialPeriod;
  date?: string;
  startDate?: string;
  endDate?: string;
}

/** Shifts a YYYY-MM-DD calendar date by `steps` days, weeks, or months in UTC, clamping month-end days. */
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

/** Formats the heading of a financial period in Asia/Ho_Chi_Minh (BR-27). */
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

/** Formats a 0..1 rate as a rounded whole percentage string. */
export function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
