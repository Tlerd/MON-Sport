import type { StaffView } from '@monsport/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@monsport/client';

export function StaffSection({ venueId }: { venueId: string }) {
  const [staffList, setStaffList] = useState<StaffView[] | null>(null);
  const [error, setError] = useState('');
  const [confirmLockId, setConfirmLockId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api<StaffView[]>(`/api/owner/venues/${venueId}/staff`)
      .then(setStaffList)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tải được danh sách nhân viên'));
  }, [venueId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!consent) {
      setFormError('Nhân viên đã đồng ý với thông báo về dữ liệu cá nhân');
      return;
    }
    setFormError('');
    setSubmitting(true);
    try {
      const created = await api<StaffView>(`/api/owner/venues/${venueId}/staff`, {
        method: 'POST',
        json: {
          name: name.trim(),
          phone: phone.trim(),
          password,
          consent: true,
        },
      });
      setStaffList((prev) => [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setPhone('');
      setPassword('');
      setConsent(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Không thêm được nhân viên');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLock(id: string) {
    setError('');
    try {
      const updated = await api<StaffView>(`/api/owner/staff/${id}/lock`, { method: 'POST' });
      setStaffList((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? null);
      setConfirmLockId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không khóa được nhân viên');
      setConfirmLockId(null);
    }
  }

  return (
    <section className="staff-section" aria-label="Nhân viên">
      <h4>Nhân viên</h4>
      {error && <p className="error" role="alert">{error}</p>}
      {staffList === null && !error && <p className="empty">Đang tải nhân viên…</p>}
      {staffList?.length === 0 && <p className="empty-staff">Chưa có nhân viên nào.</p>}

      {staffList && staffList.length > 0 && (
        <ul className="staff-list">
          {staffList.map((s) => (
            <li key={s.id} className="staff-item">
              <span className="staff-name">{s.name}</span>
              <span className="staff-phone">{s.phone}</span>
              <span className={`staff-status ${s.lockedAt ? 'locked' : 'active'}`}>
                {s.lockedAt ? 'Đã khóa' : 'Đang làm'}
              </span>
              {!s.lockedAt && (
                confirmLockId === s.id ? (
                  <span role="dialog" aria-label={`Xác nhận khóa ${s.name}`} className="confirm-lock">
                    <span>Khóa {s.name}?</span>
                    <button
                      type="button"
                      className="btn-confirm-lock"
                      onClick={() => handleLock(s.id)}
                    >
                      Xác nhận khóa
                    </button>
                    <button
                      type="button"
                      className="secondary btn-cancel-lock"
                      onClick={() => setConfirmLockId(null)}
                    >
                      Hủy
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="secondary btn-lock"
                    onClick={() => setConfirmLockId(s.id)}
                  >
                    Khóa
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreate} className="staff-form">
        <h5>Thêm nhân viên</h5>
        {formError && <p className="error" role="alert">{formError}</p>}
        <label>
          Tên nhân viên
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Tên nhân viên"
          />
        </label>
        <label>
          Số điện thoại
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="09..."
          />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Mật khẩu"
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
          />
          <span>Nhân viên đã đồng ý với thông báo về dữ liệu cá nhân</span>
        </label>
        <button type="submit" disabled={submitting || !consent}>
          Thêm nhân viên
        </button>
      </form>
    </section>
  );
}
