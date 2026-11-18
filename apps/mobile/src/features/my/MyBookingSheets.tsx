import { dayHeading, formatVnd, hhmm } from '@monsport/client';
import {
  minuteOfDayVN,
  PRICE_MAX,
  vnDateString,
  type JoinMode,
  type MyBookingView,
} from '@monsport/shared';
import { Sheet } from '../../components/Sheet.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';

const JOIN_MODE_OPTIONS: { value: JoinMode; label: string }[] = [
  { value: 'INSTANT', label: 'Vào ngay' },
  { value: 'APPROVAL', label: 'Host duyệt' },
];

export interface MyBookingSheetsProps {
  openTarget: MyBookingView | null;
  openCapacity: string;
  onChangeCapacity: (value: string) => void;
  openPrice: string;
  onChangePrice: (value: string) => void;
  openJoinMode: JoinMode;
  onChangeJoinMode: (mode: JoinMode) => void;
  openBusy: boolean;
  openValidationMessage: string;
  openAlert: string;
  onCloseOpenMatch: () => void;
  onConfirmOpenMatch: () => void;
  cancelTarget: MyBookingView | null;
  cancelBusy: boolean;
  cancelError: string;
  onCloseCancel: () => void;
  onConfirmCancel: () => void;
  sessionLoginOpen: boolean;
  onCloseSessionLogin: () => void;
  onSessionLoggedIn: () => void;
}

export function MyBookingSheets({
  openTarget,
  openCapacity,
  onChangeCapacity,
  openPrice,
  onChangePrice,
  openJoinMode,
  onChangeJoinMode,
  openBusy,
  openValidationMessage,
  openAlert,
  onCloseOpenMatch,
  onConfirmOpenMatch,
  cancelTarget,
  cancelBusy,
  cancelError,
  onCloseCancel,
  onConfirmCancel,
  sessionLoginOpen,
  onCloseSessionLogin,
  onSessionLoggedIn,
}: MyBookingSheetsProps) {
  return (
    <>
      <Sheet
        open={openTarget !== null}
        onClose={onCloseOpenMatch}
        title="Mở trận"
        primaryAction={{
          label: 'Mở trận',
          onClick: onConfirmOpenMatch,
          disabled: openBusy || Boolean(openValidationMessage),
        }}
      >
        {openTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              <div style={{ font: 'var(--font-body-strong)' }}>
                {`${openTarget.venueName} · ${openTarget.courtName}`}
              </div>
              <div style={{ font: 'var(--font-body)' }}>
                {dayHeading(vnDateString(new Date(openTarget.startAt)))}
              </div>
              <div className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink-muted)' }}>
                {`${hhmm(minuteOfDayVN(new Date(openTarget.startAt)))}–${hhmm(minuteOfDayVN(new Date(openTarget.endAt)))}`}
              </div>
            </div>

            <div>
              <label
                htmlFor="open-match-capacity"
                style={{ display: 'block', font: 'var(--font-label)', marginBottom: 'var(--space-xs)' }}
              >
                Số suất
              </label>
              <input
                id="open-match-capacity"
                type="number"
                inputMode="numeric"
                min={2}
                max={30}
                value={openCapacity}
                onChange={(e) => onChangeCapacity(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  padding: '0 var(--space-md)',
                  font: 'var(--font-body)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="open-match-price"
                style={{ display: 'block', font: 'var(--font-label)', marginBottom: 'var(--space-xs)' }}
              >
                Giá mỗi suất
              </label>
              <input
                id="open-match-price"
                type="number"
                inputMode="numeric"
                min={0}
                max={PRICE_MAX}
                value={openPrice}
                onChange={(e) => onChangePrice(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  padding: '0 var(--space-md)',
                  font: 'var(--font-body)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <fieldset style={{ margin: 0, padding: 0, border: 'none', minWidth: 0 }}>
              <legend style={{ padding: 0, font: 'var(--font-label)', marginBottom: 'var(--space-xs)' }}>
                Cách vào trận
              </legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                {JOIN_MODE_OPTIONS.map(({ value, label }) => {
                  const on = openJoinMode === value;
                  return (
                    <label
                      key={value}
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '44px',
                        minWidth: '44px',
                        padding: '0 var(--space-md)',
                        boxSizing: 'border-box',
                        borderRadius: 'var(--radius-full)',
                        border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-line)'}`,
                        backgroundColor: on ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: on ? 'var(--color-on-primary)' : 'var(--color-ink)',
                        font: 'var(--font-label)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="open-match-join-mode"
                        value={value}
                        checked={on}
                        onChange={() => onChangeJoinMode(value)}
                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {openAlert && (
              <p role="alert" style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}>
                {openAlert}
              </p>
            )}
          </div>
        )}
      </Sheet>

      <Sheet
        open={cancelTarget !== null}
        onClose={onCloseCancel}
        title="Hủy booking này?"
        primaryAction={{ label: 'Hủy booking', onClick: onConfirmCancel, disabled: cancelBusy }}
      >
        {cancelTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            <div style={{ font: 'var(--font-body-strong)' }}>
              {`${cancelTarget.venueName} · ${cancelTarget.courtName}`}
            </div>
            <div style={{ font: 'var(--font-body)' }}>
              {dayHeading(vnDateString(new Date(cancelTarget.startAt)))}
            </div>
            <div className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink-muted)' }}>
              {`${hhmm(minuteOfDayVN(new Date(cancelTarget.startAt)))}–${hhmm(minuteOfDayVN(new Date(cancelTarget.endAt)))}`}
              {' · '}
              {formatVnd(cancelTarget.priceTotal)}
            </div>
            {cancelError && (
              <p role="alert" style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}>
                {cancelError}
              </p>
            )}
          </div>
        )}
      </Sheet>

      <LoginSheet
        open={sessionLoginOpen}
        onClose={onCloseSessionLogin}
        onLoggedIn={onSessionLoggedIn}
        notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
      />
    </>
  );
}
