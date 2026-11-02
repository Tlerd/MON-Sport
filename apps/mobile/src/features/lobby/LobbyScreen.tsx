import { api, ApiError, lobbyChips, lobbyMatches } from '@monsport/client';
import type { MatchView, Sport } from '@monsport/shared';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../../app/session.tsx';
import { Chip } from '../../components/Chip.tsx';
import { ContextBar } from '../../components/ContextBar.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { IconBadminton, IconFootball, SPORT_LABEL } from '../../components/SportIcon.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import { LobbyMatchCard } from './LobbyMatchCard.tsx';
import { useLobbyStream } from './useLobbyStream.ts';

export interface LobbyScreenProps {
  now?: Date;
}

export function LobbyScreen({ now: nowProp }: LobbyScreenProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const now = nowProp ?? new Date();

  const [sport, setSport] = useState<Sport | undefined>(undefined);
  const [date, setDate] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<MatchView[] | undefined>(undefined);
  const [joinedRows, setJoinedRows] = useState<MatchView[]>([]);
  const [failed, setFailed] = useState(false);
  const [joinedFailed, setJoinedFailed] = useState(false);
  const [sessionLoginOpen, setSessionLoginOpen] = useState(false);
  const [guestLoginOpen, setGuestLoginOpen] = useState(false);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);

  const userId = user?.id;
  const role = user?.role;
  const isPlayer = role === 'USER';

  const reqCounter = useRef(0);
  const inFlight = useRef(false);
  const pending = useRef(false);
  // The login sheet opens once for each expiry, not on every SSE reload that gets a 401.
  const expiredShown = useRef(false);
  const [loginTick, setLoginTick] = useState(0);
  const roleRef = useRef(role);
  useLayoutEffect(() => {
    roleRef.current = role;
  });

  const fetchAll = useCallback(() => {
    const reqId = ++reqCounter.current;
    inFlight.current = true;
    pending.current = false;
    setFailed(false);
    const params = new URLSearchParams();
    if (sport) params.set('sport', sport);
    if (date) params.set('date', date);
    const qs = params.toString();
    const feed = api<MatchView[]>('/api/matches' + (qs ? `?${qs}` : ''));
    const joined = isPlayer
      ? api<MatchView[]>('/api/matches/joined').then(
          (list) => ({ list }),
          (error: unknown) => ({ error }),
        )
      : Promise.resolve({ list: [] as MatchView[] });
    const finish = () => {
      inFlight.current = false;
      if (pending.current) {
        pending.current = false;
        fetchRef.current();
      }
    };
    Promise.all([feed.then((list) => ({ list }), () => null), joined]).then(([f, j]) => {
      if (reqId !== reqCounter.current) return;
      if (!f) {
        setFailed(true);
        finish();
        return;
      }
      setRows(f.list);
      if ('list' in j) {
        setJoinedRows(j.list);
        setJoinedFailed(false);
      } else {
        setJoinedRows([]);
        if (j.error instanceof ApiError && j.error.status === 401) {
          setJoinedFailed(false);
          if (!expiredShown.current) {
            expiredShown.current = true;
            setSessionLoginOpen(true);
          }
        } else {
          setJoinedFailed(true);
        }
      }
      finish();
    });
  }, [sport, date, isPlayer]);

  const fetchRef = useRef(fetchAll);
  useLayoutEffect(() => {
    fetchRef.current = fetchAll;
  });

  /** Dedupe: a call during a flight asks for exactly one follow-up reload after it ends. */
  const reload = useCallback(() => {
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    fetchRef.current();
  }, []);

  const retryJoined = useCallback(() => {
    if (roleRef.current !== 'USER') return;
    const reqId = reqCounter.current;
    setJoinedFailed(false);
    api<MatchView[]>('/api/matches/joined').then(
      (list) => {
        if (reqId !== reqCounter.current) return;
        setJoinedRows(list);
      },
      (error: unknown) => {
        if (reqId !== reqCounter.current) return;
        if (error instanceof ApiError && error.status === 401) {
          if (!expiredShown.current) {
            expiredShown.current = true;
            setSessionLoginOpen(true);
          }
        } else setJoinedFailed(true);
      },
    );
  }, []);

  useEffect(() => {
    reqCounter.current++;
    inFlight.current = false;
    pending.current = false;
    expiredShown.current = false;
    setRows(undefined);
    setJoinedRows([]);
    setJoinedFailed(false);
  }, [userId]);

  useEffect(() => {
    if (user === undefined) return;
    fetchAll();
  }, [userId, user === undefined, fetchAll]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a login from the expiry sheet: reload in an effect, so the request sees the role of the new session.
  useEffect(() => {
    if (loginTick === 0) return;
    expiredShown.current = false;
    fetchRef.current();
  }, [loginTick]);

  useLobbyStream(reload, user !== undefined);

  // Step 3 adds the detail sheet for a USER. OWNER and ADMIN never call the API from a card (AC-15).
  const handleOpen = (match: MatchView) => {
    void match;
    if (role === 'OWNER' || role === 'ADMIN') setPlayerSheetOpen(true);
  };

  const handleJoin = (match: MatchView) => {
    void match;
    if (user === null) setGuestLoginOpen(true);
    else if (role === 'OWNER' || role === 'ADMIN') setPlayerSheetOpen(true);
  };

  if (user === undefined) {
    return <EmptyState message="Đang tải" />;
  }

  const chips = lobbyChips(now);
  const cards = rows ? lobbyMatches(rows, joinedRows, now, { sport, date }, userId) : undefined;

  return (
    <div style={{ minWidth: 0 }}>
      <ContextBar aria-label="Bộ lọc phòng chờ">
        <Chip selected={sport === undefined} onClick={() => setSport(undefined)}>
          Tất cả
        </Chip>
        <Chip
          selected={sport === 'BADMINTON'}
          icon={<IconBadminton size={18} />}
          onClick={() => setSport(sport === 'BADMINTON' ? undefined : 'BADMINTON')}
        >
          {SPORT_LABEL.BADMINTON}
        </Chip>
        <Chip
          selected={sport === 'FOOTBALL'}
          icon={<IconFootball size={18} />}
          onClick={() => setSport(sport === 'FOOTBALL' ? undefined : 'FOOTBALL')}
        >
          {SPORT_LABEL.FOOTBALL}
        </Chip>
        <Chip selected={date === undefined} onClick={() => setDate(undefined)}>
          Tất cả ngày
        </Chip>
        {chips.map((chip) => (
          <Chip
            key={chip.ymd}
            selected={date === chip.ymd}
            onClick={() => setDate(date === chip.ymd ? undefined : chip.ymd)}
          >
            {chip.label}
          </Chip>
        ))}
      </ContextBar>

      <div style={{ paddingTop: '61px', minWidth: 0 }}>
        {failed ? (
          <EmptyState message="Không tải được" actionLabel="Thử lại" onAction={fetchAll} />
        ) : !cards ? (
          <EmptyState message="Đang tải" />
        ) : (
          <>
            {joinedFailed && isPlayer && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-sm)',
                  padding: 'var(--space-sm) var(--space-base)',
                  font: 'var(--font-meta)',
                  color: 'var(--color-ink-muted)',
                  minWidth: 0,
                }}
              >
                <span style={{ overflowWrap: 'anywhere' }}>Không tải được trận bạn đã vào</span>
                <button
                  type="button"
                  onClick={retryJoined}
                  style={{
                    minHeight: '44px',
                    minWidth: '44px',
                    padding: '0 var(--space-md)',
                    border: '1px solid var(--color-line)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-ink)',
                    font: 'var(--font-label)',
                    cursor: 'pointer',
                  }}
                >
                  Thử lại
                </button>
              </div>
            )}
            {cards.length === 0 ? (
              <EmptyState message="Chưa có trận nào" actionLabel="Đặt sân" onAction={() => navigate('/')} />
            ) : (
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1px',
                  minWidth: 0,
                }}
              >
                {cards.map((card) => (
                  <li key={card.match.id} style={{ minWidth: 0 }}>
                    <LobbyMatchCard card={card} onJoin={handleJoin} onOpen={handleOpen} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <LoginSheet open={guestLoginOpen} onClose={() => setGuestLoginOpen(false)} />
      <LoginSheet
        open={sessionLoginOpen}
        onClose={() => setSessionLoginOpen(false)}
        onLoggedIn={() => setLoginTick((t) => t + 1)}
        notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
      />
      <Sheet
        open={playerSheetOpen}
        onClose={() => setPlayerSheetOpen(false)}
        title="Dùng tài khoản người chơi để vào trận"
      >
        <p style={{ margin: 0, font: 'var(--font-body)' }}>
          Tài khoản chủ sân và quản trị viên chỉ xem được danh sách trận. Hãy đăng nhập bằng tài khoản người
          chơi để vào trận.
        </p>
      </Sheet>
    </div>
  );
}
