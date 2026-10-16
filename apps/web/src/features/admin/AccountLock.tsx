import type { AccountView } from '@monsport/shared';
import { type FormEvent, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';

const ROLE = { ADMIN: 'Admin', OWNER: 'Chủ sân', USER: 'Người dùng' } as const;

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
    <section className="panel">
      <h2>Khóa tài khoản</h2>
      <form onSubmit={search} className="search">
        <label>
          Số điện thoại cần tìm
          <input inputMode="tel" maxLength={10} value={phone} onChange={(e) => { setPhone(e.target.value); setFound(null); latest.current++; }} required />
        </label>
        <button type="submit">Tìm</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="live empty" role="status">
        {found?.length === 0 ? 'Không có tài khoản nào dùng số này.' : found?.[0]?.lockedAt ? `${found[0].name} đã bị khóa.` : ''}
      </p>
      <ul className="accounts">
        {found?.map((a) => (
          <li key={a.id}>
            <span className="customer">{a.name}</span>
            <span className="phone">{a.phone}</span>
            <span>{ROLE[a.role]}</span>
            {a.lockedAt && <span className="status locked">Đã khóa</span>}
            {a.role !== 'ADMIN' && (
              <button type="button" className={a.lockedAt ? undefined : 'secondary'} onClick={() => toggle(a)}>
                {a.lockedAt ? 'Mở khóa' : 'Khóa'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
