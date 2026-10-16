import type { AccountView } from '@monsport/shared';
import { type FormEvent, useState } from 'react';
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

  async function search(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      setFound(await api<AccountView[]>('/api/admin/users/search', { method: 'POST', json: { phone } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tìm được tài khoản');
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
          <input inputMode="tel" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>
        <button type="submit">Tìm</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {found?.length === 0 && <p className="empty">Không có tài khoản nào dùng số này.</p>}
      <ul className="accounts">
        {found?.map((a) => (
          <li key={a.id} aria-label={a.name}>
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
