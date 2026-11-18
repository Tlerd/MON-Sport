import type { AccessTokenScope, OAuthConnectionView } from '@monsport/shared';
import { useEffect, useRef, useState } from 'react';
import { errorMessage, listOAuthConnections, revokeOAuthConnection } from '@monsport/client';
import { useAction } from '../../hooks/useAction.ts';

const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const SCOPE_LABEL: Record<AccessTokenScope, string> = { BOOK: 'Đặt sân', READ: 'Chỉ xem' };
const BREAK_ALL = { wordBreak: 'break-all' } as const;

function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

async function loadConnectorUrl(): Promise<string | null> {
  try {
    const res = await fetch('/.well-known/oauth-protected-resource/api/mcp');
    if (!res.ok) return null;
    const body = (await res.json()) as { resource?: unknown };
    return typeof body?.resource === 'string' && body.resource !== '' ? body.resource : null;
  } catch {
    return null;
  }
}

export function OAuthConnections() {
  const [connections, setConnections] = useState<OAuthConnectionView[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { run, busy: revoking, error, setError } = useAction();
  const [connectorUrl, setConnectorUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (confirmId) confirmBtnRef.current?.focus();
  }, [confirmId]);

  useEffect(() => {
    listOAuthConnections()
      .then((res) => setConnections(res.connections ?? []))
      .catch((err) => setError(errorMessage(err, 'Không tải được danh sách ứng dụng')));
    void loadConnectorUrl().then(setConnectorUrl);
  }, [setError]);

  function closeConfirm() {
    setConfirmId(null);
    headingRef.current?.focus();
  }

  async function handleRevoke(id: string) {
    if (revoking) return;
    await run(async () => {
      await revokeOAuthConnection(id);
      setConnections((prev) => prev?.filter((c) => c.id !== id) ?? null);
    }, 'Không thu hồi được ứng dụng');
    closeConfirm();
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="stack-form">
      <h3 ref={headingRef} tabIndex={-1}>
        Ứng dụng đã nối
      </h3>
      {connectorUrl !== null && (
        <p>
          Địa chỉ connector: <code style={BREAK_ALL}>{connectorUrl}</code>{' '}
          <button type="button" className="btn sm" onClick={() => copyUrl(connectorUrl)}>
            {copied ? 'Đã chép' : 'Chép'}
          </button>
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {connections === null && !error && <p className="empty">Đang tải ứng dụng…</p>}
      {connections?.length === 0 && <p className="empty">Chưa có ứng dụng nào được nối.</p>}
      {connections && connections.length > 0 && (
        <div className="table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Ứng dụng</th>
                <th scope="col">Quyền</th>
                <th scope="col">Nối từ</th>
                <th scope="col">Lần dùng</th>
                <th scope="col" className="r">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {connections.map((c) => (
                <tr key={c.id}>
                  <td data-label="Ứng dụng">
                    <b>{c.clientName}</b>
                  </td>
                  <td data-label="Quyền">
                    <span className={`tag ${c.scope === 'BOOK' ? 'ok' : 'ghost'}`}>{SCOPE_LABEL[c.scope]}</span>
                  </td>
                  <td data-label="Nối từ">Nối từ {formatDate(c.createdAt)}</td>
                  <td data-label="Lần dùng">
                    {c.lastUsedAt === null ? 'Chưa dùng' : `Dùng lần cuối ${formatDate(c.lastUsedAt)}`}
                  </td>
                  <td data-label="Thao tác" className="r">
                    {confirmId === c.id ? (
                      <span role="dialog" aria-label={`Xác nhận thu hồi ${c.clientName}`} className="confirm-lock">
                        <span>Thu hồi {c.clientName}? Ứng dụng này sẽ mất quyền ngay.</span>
                        <button
                          ref={confirmBtnRef}
                          type="button"
                          className="btn sm danger"
                          disabled={revoking}
                          onClick={() => handleRevoke(c.id)}
                        >
                          Xác nhận thu hồi
                        </button>
                        <button type="button" className="btn sm ghost" disabled={revoking} onClick={closeConfirm}>
                          Hủy
                        </button>
                      </span>
                    ) : (
                      <button type="button" className="btn sm ghost" onClick={() => setConfirmId(c.id)}>
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
    </div>
  );
}
