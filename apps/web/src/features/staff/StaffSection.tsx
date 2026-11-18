import type { StaffView } from '@monsport/shared';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useAction } from '../../hooks/useAction.ts';
import { errorMessage, api } from '@monsport/client';

export function StaffSection({ venueId }: { venueId: string }) {
  const [staffList, setStaffList] = useState<StaffView[] | null>(null);
  const [error, setError] = useState('');
  const [confirmLockId, setConfirmLockId] = useState<string | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const create = useAction();
  const { busy: submitting, error: formError } = create;

  useEffect(() => {
    if (confirmLockId) {
      confirmBtnRef.current?.focus();
    }
  }, [confirmLockId]);

  useEffect(() => {
    api<StaffView[]>(`/api/owner/venues/${venueId}/staff`)
      .then(setStaffList)
      .catch((err) => setError(errorMessage(err, 'Không tải được danh sách nhân viên')));
  }, [venueId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (submitting || !consent) return;
    await create.run(async () => {
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
    }, 'Không thêm được nhân viên');
  }

  async function handleLock(id: string) {
    setError('');
    try {
      const updated = await api<StaffView>(`/api/owner/staff/${id}/lock`, { method: 'POST' });
      setStaffList((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? null);
      setConfirmLockId(null);
    } catch (err) {
      setError(errorMessage(err, 'Không khóa được nhân viên'));
      setConfirmLockId(null);
    }
  }

  return (
    <section className="card pad staff-section" aria-label="Nhân viên">
      <h4>Nhân viên</h4>
      {error && <p className="error" role="alert">{error}</p>}
      {staffList === null && !error && <p className="empty">Đang tải nhân viên…</p>}
      {staffList?.length === 0 && <p className="empty">Chưa có nhân viên nào.</p>}

      {staffList && staffList.length > 0 && (
        <div className="table-scroll">
          <table className="tbl staff-tbl">
            <thead>
              <tr>
                <th scope="col">Nhân viên</th>
                <th scope="col">Số điện thoại</th>
                <th scope="col">Trạng thái</th>
                <th scope="col" className="r">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((s) => (
                <tr key={s.id} className={s.lockedAt ? 'muted' : undefined}>
                  <td data-label="Nhân viên">
                    <b>{s.name}</b>
                  </td>
                  <td data-label="Số điện thoại" className="phone tnum">
                    {s.phone}
                  </td>
                  <td data-label="Trạng thái">
                    <span className={`tag ${s.lockedAt ? 'bad' : 'ok'}`}>
                      {s.lockedAt ? 'Đã khóa' : 'Đang làm'}
                    </span>
                  </td>
                  <td data-label="Thao tác" className="r">
                    {!s.lockedAt && (
                      confirmLockId === s.id ? (
                        <span role="dialog" aria-label={`Xác nhận khóa ${s.name}`} className="confirm-lock">
                          <span>Khóa {s.name}?</span>
                          <button
                            ref={confirmBtnRef}
                            type="button"
                            className="btn sm danger"
                            onClick={() => handleLock(s.id)}
                          >
                            Xác nhận khóa
                          </button>
                          <button
                            type="button"
                            className="btn sm ghost"
                            onClick={() => setConfirmLockId(null)}
                          >
                            Hủy
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn sm ghost"
                          onClick={() => setConfirmLockId(s.id)}
                        >
                          Khóa
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleCreate} className="staff-form stack-form">
        <h5>Thêm nhân viên</h5>
        {formError && <p className="error" role="alert">{formError}</p>}
        <div className="fgrid three">
          <label className="fld">
            <span>Tên nhân viên</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Tên nhân viên"
            />
          </label>
          <label className="fld">
            <span>Số điện thoại</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="09..."
            />
          </label>
          <label className="fld">
            <span>Mật khẩu</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mật khẩu"
            />
          </label>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            required
          />
          <span>Nhân viên đã đồng ý với thông báo về dữ liệu cá nhân</span>
        </label>
        <div className="actions">
          <button type="submit" className="btn lime" disabled={submitting || !consent}>
            Thêm nhân viên
          </button>
        </div>
      </form>
    </section>
  );
}
