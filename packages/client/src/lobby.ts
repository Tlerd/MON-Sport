import { addDaysYmd, vnDateString } from '@monsport/shared';
import type { MatchView, Sport } from '@monsport/shared';
import { dayChipLabel } from './booking.ts';

export interface LobbyFilter {
  sport?: Sport;
  date?: string;
}

export interface LobbyCard {
  match: MatchView;
  joined: boolean;
  isHost: boolean;
}

const byStart = (a: MatchView, b: MatchView) =>
  Date.parse(a.startAt) - Date.parse(b.startAt) || Date.parse(a.createdAt) - Date.parse(b.createdAt);

export function lobbyMatches(
  rows: readonly MatchView[],
  joinedRows: readonly MatchView[],
  now: Date,
  filter: LobbyFilter = {},
  userId?: string,
): LobbyCard[] {
  const cards = new Map<string, LobbyCard>();
  const add = (match: MatchView, joined: boolean) => {
    const known = cards.get(match.id);
    if (known) {
      if (joined) known.joined = true;
      return;
    }
    cards.set(match.id, { match, joined, isHost: userId !== undefined && match.hostId === userId });
  };
  for (const m of rows) add(m, false);
  for (const m of joinedRows) if (m.status === 'OPEN' || m.status === 'FULL') add(m, true);
  return [...cards.values()]
    .filter(
      ({ match }) =>
        Date.parse(match.startAt) > now.getTime() &&
        (filter.sport === undefined || match.sport === filter.sport) &&
        (filter.date === undefined || vnDateString(new Date(match.startAt)) === filter.date),
    )
    .sort((a, b) => byStart(a.match, b.match));
}

export function lobbyChips(now: Date): { ymd: string; label: string }[] {
  const today = vnDateString(now);
  return Array.from({ length: 7 }, (_, i) => {
    const ymd = addDaysYmd(today, i);
    return { ymd, label: dayChipLabel(ymd) };
  });
}

export function matchesForDay(rows: readonly MatchView[], ymd: string): MatchView[] {
  return rows.filter((m) => vnDateString(new Date(m.startAt)) === ymd);
}
