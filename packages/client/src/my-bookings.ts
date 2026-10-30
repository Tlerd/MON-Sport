import type { MatchView, MyBookingView } from '@monsport/shared';

/** A new array sorted by startAt ascending, breaking ties by createdAt ascending. */
export function sortUpcoming(rows: readonly MyBookingView[]): MyBookingView[] {
  return [...rows].sort(
    (a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
}

/** A new array sorted by startAt descending, breaking ties by createdAt descending. */
export function sortHistory(rows: readonly MyBookingView[]): MyBookingView[] {
  return [...rows].sort(
    (a, b) => Date.parse(b.startAt) - Date.parse(a.startAt) || Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

/**
 * Splits bookings into upcoming (future PENDING or CONFIRMED) and history (past, in progress, or non-active).
 * Upcoming is sorted ascending; history is sorted descending. Does not mutate rows.
 */
export function splitMine(
  rows: readonly MyBookingView[],
  now: Date,
): { upcoming: MyBookingView[]; history: MyBookingView[] } {
  const upcoming: MyBookingView[] = [];
  const history: MyBookingView[] = [];
  for (const row of rows) {
    if ((row.status === 'PENDING' || row.status === 'CONFIRMED') && Date.parse(row.startAt) > now.getTime()) {
      upcoming.push(row);
    } else {
      history.push(row);
    }
  }
  return {
    upcoming: sortUpcoming(upcoming),
    history: sortHistory(history),
  };
}

/**
 * Keeps matches where hostId !== userId, status is OPEN or FULL, and startAt is in the future.
 * Sorted by startAt ascending. Does not mutate matches.
 */
export function joinedByOthers(matches: readonly MatchView[], userId: string, now: Date): MatchView[] {
  return matches
    .filter(
      (m) =>
        m.hostId !== userId &&
        (m.status === 'OPEN' || m.status === 'FULL') &&
        Date.parse(m.startAt) > now.getTime(),
    )
    .sort(
      (a, b) => Date.parse(a.startAt) - Date.parse(b.startAt) || Date.parse(a.createdAt) - Date.parse(b.createdAt),
    );
}
