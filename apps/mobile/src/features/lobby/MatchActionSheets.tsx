import { dayHeading, hhmm } from '@monsport/client';
import { minuteOfDayVN, vnDateString, type MatchView } from '@monsport/shared';
import { Sheet } from '../../components/Sheet.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';

export interface MatchActionSheetsProps {
  leaveTarget: MatchView | null;
  leaveBusy: boolean;
  leaveError: string;
  onCloseLeave: () => void;
  onConfirmLeave: () => void;
  cancelTarget: MatchView | null;
  cancelBusy: boolean;
  cancelError: string;
  onCloseCancel: () => void;
  onConfirmCancel: () => void;
  guestLoginOpen: boolean;
  onCloseGuestLogin: () => void;
  onGuestLoggedIn: () => void;
  sessionLoginOpen: boolean;
  onCloseSessionLogin: () => void;
  onSessionLoggedIn: () => void;
  playerSheetOpen: boolean;
  onClosePlayerSheet: () => void;
}

export function MatchActionSheets({
  leaveTarget,
  leaveBusy,
  leaveError,
  onCloseLeave,
  onConfirmLeave,
  cancelTarget,
  cancelBusy,
  cancelError,
  onCloseCancel,
  onConfirmCancel,
  guestLoginOpen,
  onCloseGuestLogin,
  onGuestLoggedIn,
  sessionLoginOpen,
  onCloseSessionLogin,
  onSessionLoggedIn,
  playerSheetOpen,
  onClosePlayerSheet,
}: MatchActionSheetsProps) {
  return (
    <>
      <Sheet
        open={leaveTarget !== null}
        onClose={onCloseLeave}
        title="Rời trận này?"
        primaryAction={{ label: 'Rời trận', onClick: onConfirmLeave, disabled: leaveBusy }}
      >
        {leaveTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', minWidth: 0 }}>
            <div style={{ font: 'var(--font-body-strong)', overflowWrap: 'anywhere', minWidth: 0 }}>
              {`${leaveTarget.venueName} · ${leaveTarget.courtName}`}
            </div>
            <div style={{ font: 'var(--font-body)', minWidth: 0 }}>
              {dayHeading(vnDateString(new Date(leaveTarget.startAt)))}
            </div>
            <div className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink-muted)', minWidth: 0 }}>
              {`${hhmm(minuteOfDayVN(new Date(leaveTarget.startAt)))}–${hhmm(minuteOfDayVN(new Date(leaveTarget.endAt)))}`}
            </div>
            {leaveError && (
              <p role="alert" style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}>
                {leaveError}
              </p>
            )}
          </div>
        )}
      </Sheet>

      <Sheet
        open={cancelTarget !== null}
        onClose={onCloseCancel}
        title="Hủy trận này?"
        primaryAction={{ label: 'Hủy trận', onClick: onConfirmCancel, disabled: cancelBusy }}
      >
        {cancelTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', minWidth: 0 }}>
            <div style={{ font: 'var(--font-body-strong)', overflowWrap: 'anywhere', minWidth: 0 }}>
              {`${cancelTarget.venueName} · ${cancelTarget.courtName}`}
            </div>
            <div style={{ font: 'var(--font-body)', minWidth: 0 }}>
              {dayHeading(vnDateString(new Date(cancelTarget.startAt)))}
            </div>
            <div className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink-muted)', minWidth: 0 }}>
              {`${hhmm(minuteOfDayVN(new Date(cancelTarget.startAt)))}–${hhmm(minuteOfDayVN(new Date(cancelTarget.endAt)))}`}
            </div>
            <p style={{ margin: 0, font: 'var(--font-body)', color: 'var(--color-ink)' }}>
              Trận và booking của trận sẽ bị hủy. Người trong trận sẽ nhận thông báo.
            </p>
            {cancelError && (
              <p role="alert" style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}>
                {cancelError}
              </p>
            )}
          </div>
        )}
      </Sheet>

      <LoginSheet open={guestLoginOpen} onClose={onCloseGuestLogin} onLoggedIn={onGuestLoggedIn} />
      <LoginSheet
        open={sessionLoginOpen}
        onClose={onCloseSessionLogin}
        onLoggedIn={onSessionLoggedIn}
        notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
      />
      <Sheet
        open={playerSheetOpen}
        onClose={onClosePlayerSheet}
        title="Dùng tài khoản người chơi để vào trận"
      >
        <p style={{ margin: 0, font: 'var(--font-body)' }}>
          Tài khoản chủ sân và quản trị viên chỉ xem được danh sách trận. Hãy đăng nhập bằng tài khoản người
          chơi để vào trận.
        </p>
      </Sheet>
    </>
  );
}
