import type { AccountView } from '@monsport/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';
import { AccountLock } from './AccountLock.tsx';
import { VenueAdmin } from './VenueAdmin.tsx';

const message = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/** UC-10: the admin creates owners, venues, and courts, and locks accounts (brief F-003). */
export function AdminPanel() {
  const [owners, setOwners] = useState<AccountView[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<AccountView[]>('/api/admin/owners').then(setOwners, () => setError('Không tải được danh sách chủ sân'));
  }, []);

  return (
    <>
      <section className="panel">
        <h2>Chủ sân</h2>
        {error && <p className="error" role="alert">{error}</p>}
        {owners.length === 0 && !error && <p className="empty">Chưa có chủ sân. Tạo chủ sân trước, rồi tạo đơn vị cho họ.</p>}
        <ul className="accounts">
          {owners.map((o) => (
            <li key={o.id}>
              <span className="customer">{o.name}</span>
              <span className="phone">{o.phone}</span>
              {o.lockedAt && <span className="status locked">Đã khóa</span>}
            </li>
          ))}
        </ul>
        <OwnerForm onCreated={(o) => setOwners((list) => [...list, o].sort((a, b) => a.name.localeCompare(b.name, 'vi')))} />
      </section>
      <VenueAdmin owners={owners} />
      <AccountLock onChanged={(a) => setOwners((list) => list.map((o) => (o.id === a.id ? a : o)))} />
    </>
  );
}

/** UC-10, step 1: an owner account with a first password that the admin hands over in person. */
function OwnerForm({ onCreated }: { onCreated: (owner: AccountView) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      onCreated(await api<AccountView>('/api/admin/owners', { method: 'POST', json: { name, phone, password } }));
      setName('');
      setPhone('');
      setPassword('');
    } catch (err) {
      setError(message(err, 'Không tạo được chủ sân'));
    }
  }

  return (
    <details className="drawer">
      <summary>Tạo chủ sân</summary>
      <form onSubmit={submit} className="stack">
        <label>
          Tên chủ sân
          <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Số điện thoại chủ sân
          <input inputMode="tel" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>
        <div>
          <label>
            Mật khẩu ban đầu
            <input type="password" autoComplete="new-password" minLength={8} maxLength={128} aria-describedby="owner-password-hint"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <p id="owner-password-hint" className="hint">Ít nhất 8 ký tự. Mỗi chủ sân một mật khẩu riêng. Đưa mật khẩu cho chủ sân qua kênh riêng.</p>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit">Tạo chủ sân</button>
      </form>
    </details>
  );
}
