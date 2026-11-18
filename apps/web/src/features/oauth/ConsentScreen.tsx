import type { OAuthConsentView, SessionUser } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ApiError, approveConsent, denyConsent, getConsent } from '@monsport/client';

// Brief F-038 (AC-16): the "Cho phép" screen. A client such as Claude sends the user here to allow access.

// A feature may not import the app layer, so the page passes the session user in. undefined: still loading.
export function ConsentScreen({ user }: { user: SessionUser | null | undefined }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('yeu-cau') ?? '';

  const [consent, setConsent] = useState<OAuthConsentView | null>(null);
  const [error, setError] = useState('');
  const [allowBook, setAllowBook] = useState(true);
  const [busy, setBusy] = useState(false);

  const isUser = user?.role === 'USER';

  useEffect(() => {
    if (user === null) {
      const back = `/ket-noi-ai/cho-phep?yeu-cau=${id}`;
      navigate(`/dang-nhap?tiep=${encodeURIComponent(back)}`, { replace: true });
    }
  }, [user, id, navigate]);

  useEffect(() => {
    if (!isUser) return;
    if (id === '') {
      setError('Yêu cầu không hợp lệ. Nối lại từ Claude');
      return;
    }
    getConsent(id)
      .then(setConsent)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tải được yêu cầu. Nối lại từ Claude'));
  }, [isUser, id]);

  if (user === undefined || user === null) return null;
  if (!isUser) {
    return (
      <div className="page narrow">
        <section className="card pad stack-form">
          <p className="error" role="alert">
            Bạn không có quyền làm việc này
          </p>
        </section>
      </div>
    );
  }

  const canBook = consent?.scopes.includes('book') ?? false;

  async function decide(allow: boolean) {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const res = allow
        ? await approveConsent(id, { scopes: canBook && allowBook ? ['read', 'book'] : ['read'] })
        : await denyConsent(id);
      window.location.assign(res.redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được lựa chọn. Thử lại');
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <section className="card pad stack-form" aria-label="Cho phép kết nối">
        {consent === null && error === '' && <p className="empty">Đang tải…</p>}
        {error !== '' && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {consent !== null && (
          <>
            <h1>
              {consent.clientName} ({consent.clientHost}) muốn dùng tài khoản MONSPORT của bạn
            </h1>
            <ul>
              {consent.dataRead.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <label className="checkbox-row">
              <input type="checkbox" checked disabled readOnly />
              <span>Xem sân, giờ trống, trận và booking của bạn</span>
            </label>
            {canBook && (
              <label className="checkbox-row">
                <input type="checkbox" checked={allowBook} onChange={(e) => setAllowBook(e.target.checked)} />
                <span>Đặt sân, hủy booking, mở và vào trận</span>
              </label>
            )}
            <div className="actions">
              <button type="button" className="btn lime" disabled={busy} onClick={() => decide(true)}>
                Cho phép
              </button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => decide(false)}>
                Từ chối
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
