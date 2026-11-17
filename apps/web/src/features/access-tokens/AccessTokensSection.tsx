import { MAX_ACTIVE_ACCESS_TOKENS, type AccessTokenScope, type AccessTokenView } from '@monsport/shared';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ApiError, createAccessToken, listAccessTokens, revokeAccessToken } from '@monsport/client';

// Brief F-037 (AC-13, AC-14): the "Kết nối AI" section of /ho-so.

const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

const SCOPE_LABEL: Record<AccessTokenScope, string> = { BOOK: 'Đặt sân', READ: 'Chỉ xem' };
const SCOPE_HINT: Record<AccessTokenScope, string> = {
  BOOK: 'AI tìm sân, đặt sân, hủy booking và vào trận.',
  READ: 'AI chỉ xem sân, giờ trống, trận và booking của bạn.',
};
const LIMIT_MESSAGE = `Bạn đã có ${MAX_ACTIVE_ACCESS_TOKENS} mã. Thu hồi một mã trước`;
const BREAK_ALL = { wordBreak: 'break-all' } as const;

export function AccessTokensSection() {
  const [tokens, setTokens] = useState<AccessTokenView[] | null>(null);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  // Focus goes back here when the confirm or the secret panel closes, so it never falls to <body>.
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [revoking, setRevoking] = useState(false);

  const [name, setName] = useState('');
  const [scope, setScope] = useState<AccessTokenScope>('BOOK');
  const [expiresInDays, setExpiresInDays] = useState<30 | 90>(30);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [secret, setSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  useEffect(() => {
    if (confirmId) confirmBtnRef.current?.focus();
  }, [confirmId]);

  useEffect(() => {
    listAccessTokens()
      .then((res) => setTokens(res.tokens))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tải được danh sách mã'));
  }, []);

  const atLimit = (tokens?.length ?? 0) >= MAX_ACTIVE_ACCESS_TOKENS;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (submitting || atLimit || name.trim() === '') return;
    setFormError('');
    setSubmitting(true);
    try {
      const created = await createAccessToken({ name: name.trim(), scope, expiresInDays });
      setTokens((prev) => [created.token, ...(prev ?? [])]);
      setSecret(created.secret);
      setCopiedSecret(false);
      setCopiedCommand(false);
      setName('');
      setScope('BOOK');
      setExpiresInDays(30);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Không tạo được mã');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id: string) {
    if (revoking) return;
    setError('');
    setRevoking(true);
    try {
      await revokeAccessToken(id);
      setTokens((prev) => prev?.filter((t) => t.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thu hồi được mã');
    } finally {
      setRevoking(false);
    }
    closeConfirm();
  }

  function closeConfirm() {
    setConfirmId(null);
    headingRef.current?.focus();
  }

  async function copy(text: string, done: (v: boolean) => void) {
    try {
      await navigator.clipboard.writeText(text);
      done(true);
    } catch {
      done(false);
    }
  }

  const command =
    secret === null
      ? ''
      : `claude mcp add --transport http monsport ${window.location.origin}/api/mcp --header "Authorization: Bearer ${secret}"`;

  return (
    <section className="card pad stack-form" aria-label="Kết nối AI">
      <h2 ref={headingRef} tabIndex={-1}>
        Kết nối AI
      </h2>
      <p className="meta">Tạo mã để một AI (ví dụ Claude Code) tìm sân và đặt sân bằng tài khoản của bạn.</p>

      {secret !== null && (
        <div className="card pad stack-form" role="status" style={{ background: 'var(--lime-soft)', gap: 10, justifyItems: 'start' }}>
          <b>Mã chỉ hiện một lần. Lưu nó ngay</b>
          <p>
            <code style={BREAK_ALL}>{secret}</code>{' '}
            <button type="button" className="btn sm" onClick={() => copy(secret, setCopiedSecret)}>
              {copiedSecret ? 'Đã chép' : 'Chép'}
            </button>
          </p>
          <p>Lệnh nối Claude Code:</p>
          {/* pre-wrap: a <pre> keeps the long command on one line, which overflows a 390px screen. */}
          <pre style={{ ...BREAK_ALL, whiteSpace: 'pre-wrap', margin: 0 }}>
            <code style={BREAK_ALL}>{command}</code>
          </pre>
          <button type="button" className="btn sm" onClick={() => copy(command, setCopiedCommand)}>
            {copiedCommand ? 'Đã chép' : 'Chép'}
          </button>
          <p className="small">Ai có mã này thì đặt sân được bằng tài khoản của bạn. Không gửi mã cho người khác.</p>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setSecret(null);
              setCopiedSecret(false);
              setCopiedCommand(false);
              headingRef.current?.focus();
            }}
          >
            Xong
          </button>
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {tokens === null && !error && <p className="empty">Đang tải mã…</p>}
      {tokens?.length === 0 && <p className="empty">Bạn chưa có mã nào.</p>}

      {tokens && tokens.length > 0 && (
        <div className="table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Mã</th>
                <th scope="col">Quyền</th>
                <th scope="col">Đầu mã</th>
                <th scope="col">Hạn dùng</th>
                <th scope="col">Lần dùng</th>
                <th scope="col" className="r">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td data-label="Mã">
                    <b>{t.name}</b>
                  </td>
                  <td data-label="Quyền">
                    <span className={`tag ${t.scope === 'BOOK' ? 'ok' : 'ghost'}`}>{SCOPE_LABEL[t.scope]}</span>
                  </td>
                  <td data-label="Đầu mã">
                    <code>{t.prefix}…</code>
                  </td>
                  <td data-label="Hạn dùng">Hết hạn {formatDate(t.expiresAt)}</td>
                  <td data-label="Lần dùng">
                    {t.lastUsedAt === null ? 'Chưa dùng' : `Dùng lần cuối ${formatDate(t.lastUsedAt)}`}
                  </td>
                  <td data-label="Thao tác" className="r">
                    {confirmId === t.id ? (
                      <span role="dialog" aria-label={`Xác nhận thu hồi ${t.name}`} className="confirm-lock">
                        <span>Thu hồi mã {t.name}? AI dùng mã này sẽ mất quyền ngay.</span>
                        <button
                          ref={confirmBtnRef}
                          type="button"
                          className="btn sm danger"
                          disabled={revoking}
                          onClick={() => handleRevoke(t.id)}
                        >
                          Xác nhận thu hồi
                        </button>
                        <button type="button" className="btn sm ghost" disabled={revoking} onClick={closeConfirm}>
                          Hủy
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="btn sm ghost" onClick={() => setConfirmId(t.id)}>
                        Thu hồi
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleCreate} className="stack-form">
        <h3>Tạo mã mới</h3>
        {formError && (
          <p className="error" role="alert">
            {formError}
          </p>
        )}
        <label className="fld">
          <span>Tên mã</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            required
            placeholder="Ví dụ: Claude Code trên máy tính"
          />
        </label>
        <div className="fld">
          <span id="access-token-scope">Quyền</span>
          <div className="seg" role="group" aria-labelledby="access-token-scope">
            {(['BOOK', 'READ'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)}>
                {SCOPE_LABEL[s]}
              </button>
            ))}
          </div>
          <small className="dim">{SCOPE_HINT[scope]}</small>
        </div>
        <div className="fld">
          <span id="access-token-expiry">Hạn dùng</span>
          <div className="seg" role="group" aria-labelledby="access-token-expiry">
            {([30, 90] as const).map((d) => (
              <button key={d} type="button" aria-pressed={expiresInDays === d} onClick={() => setExpiresInDays(d)}>
                {d} ngày
              </button>
            ))}
          </div>
        </div>
        {atLimit && <p className="small dim">{LIMIT_MESSAGE}</p>}
        <div className="actions">
          <button type="submit" className="btn lime" disabled={submitting || name.trim() === '' || atLimit}>
            Tạo mã
          </button>
        </div>
      </form>
    </section>
  );
}
