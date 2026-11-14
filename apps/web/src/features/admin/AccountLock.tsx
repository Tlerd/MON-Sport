import type { AccountView } from '@monsport/shared';
import { type FormEvent, useRef, useState } from 'react';
import { api, ApiError } from '@monsport/client';

const ROLE = { ADMIN: 'Admin', OWNER: 'Chủ sân', USER: 'Người dùng', STAFF: 'Nhân viên' } as const;

/**
 * UC-10, flow 10.1 and BR-28. The admin finds one account by its exact phone number (BR-20: no list of users),
 * then locks or unlocks it.
 */
export function AccountLock({ onChanged }: { onChanged: (account: AccountView) => void }) {
  const [phone, setPhone] = useState('');
  const [found, setFound] = useState<AccountView[] | null>(null);
  const [error, setError] = useState('');
  const latest = useRef(0);

  async function search(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFound(null); // An old result must not stay under a new number, or the admin could lock the wrong account.
    const request = ++latest.current; // A late answer to an older search is dropped.
    try {
      const result = await api<AccountView[]>('/api/admin/users/search', { method: 'POST', json: { phone } });
      if (request === latest.current) setFound(result);
    } catch (err) {
      if (request === latest.current) setError(err instanceof ApiError ? err.message : 'Không tìm được tài khoản');
    }
  }

  async function toggle(account: AccountView) {
    setError('');
    try {
      const action = account.lockedAt ? 'unlock' : 'lock';
      const updated = await api<AccountView>(`/api/admin/users/${account.id}/${action}`, { method: 'POST' });
      setFound([updated]);
      onChanged(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được');
    }
  }

  return (
    <section className="panel card pad">
      <h2>Khóa tài khoản</h2>
      <form onSubmit={search} className="fbar">
        <label className="fld">
          <span>Số điện thoại cần tìm</span>
          <input inputMode="tel" maxLength={10} value={phone} onChange={(e) => { setPhone(e.target.value); setFound(null); latest.current++; }} required />
        </label>
        <button type="submit" className="btn lime">Tìm</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="live empty" role="status">
        {found?.length === 0 ? 'Không có tài khoản nào dùng số này.' : found?.[0]?.lockedAt ? `${found[0].name} đã bị khóa.` : ''}
      </p>
      <ul className="tickets accounts">
        {found?.map((a) => (
          <li key={a.id} className="card si">
            <span className="customer">{a.name}</span>
            <span className="phone tnum">{a.phone}</span>
            <span>{ROLE[a.role]}</span>
            <span className={`tag ${a.lockedAt ? 'bad' : 'ok'}`}>
              {a.lockedAt ? 'Đã khóa' : 'Hoạt động'}
            </span>
            {a.role !== 'ADMIN' && (
              <button
                type="button"
                className={a.lockedAt ? 'btn sm lime' : 'btn sm danger'}
                onClick={() => toggle(a)}
              >
                {a.lockedAt ? 'Mở khóa' : 'Khóa'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
