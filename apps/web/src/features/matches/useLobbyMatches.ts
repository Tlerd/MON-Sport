import { addDaysYmd, vnDateString, type MatchView, type SkillLevel } from '@monsport/shared';
import { api } from '@monsport/client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDayChip } from '../../lib/dates.ts';

interface UseLobbyMatchesOptions {
  refresh?: number;
  onStreamMatch?: () => void;
}

export function useLobbyMatches({ refresh = 0, onStreamMatch }: UseLobbyMatchesOptions = {}) {
  const [sport, setSport] = useState('');
  const [level, setLevel] = useState<SkillLevel | ''>('');
  const [date, setDate] = useState('');
  const [typeTab, setTypeTab] = useState<'ALL' | 'SINGLE'>('ALL');
  const [matches, setMatches] = useState<MatchView[] | null>(null);
  const [error, setError] = useState('');
  const [streamTick, setStreamTick] = useState(0);

  const onStreamMatchRef = useRef(onStreamMatch);
  onStreamMatchRef.current = onStreamMatch;

  const todayStr = useMemo(() => vnDateString(new Date()), []);
  const dateOptions = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const ymd = addDaysYmd(todayStr, i);
      return {
        ymd,
        label: i === 0 ? 'Hôm nay' : formatDayChip(ymd),
      };
    });
  }, [todayStr]);

  const isOtherDate = date !== '' && !dateOptions.some((d) => d.ymd === date);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const es = new EventSource('/api/matches/stream');
    es.addEventListener('match', () => {
      setStreamTick((t) => t + 1);
      onStreamMatchRef.current?.();
    });
    return () => {
      es.close();
    };
  }, []);

  useEffect(() => {
    let current = true;
    setError('');
    const params = new URLSearchParams();
    if (sport) params.set('sport', sport);
    if (level) params.set('level', level);
    if (date) params.set('date', date);
    const qs = params.toString();
    const url = qs ? `/api/matches?${qs}` : '/api/matches';
    api<MatchView[]>(url).then(
      (rows) => {
        if (current) setMatches(rows);
      },
      () => {
        if (!current) return;
        setMatches([]);
        setError('Không tải được danh sách phòng chờ');
      },
    );
    return () => {
      current = false;
    };
  }, [sport, level, date, refresh, streamTick]);

  return {
    sport,
    setSport,
    level,
    setLevel,
    date,
    setDate,
    typeTab,
    setTypeTab,
    matches,
    setMatches,
    error,
    dateOptions,
    isOtherDate,
  };
}
