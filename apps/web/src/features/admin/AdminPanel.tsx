import type { AccountView } from '@monsport/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { errorMessage, api } from '@monsport/client';
import { EmptyState } from '../../components/EmptyState.tsx';
import { AccountLock } from './AccountLock.tsx';
import { AdminStats } from './AdminStats.tsx';
import { VenueAdmin } from './VenueAdmin.tsx';

export function AdminPanel({ view = 'accounts' }: { view?: 'accounts' | 'stats' } = {}) {
  return view === 'stats' ? <AdminStats /> : <AccountsTab />;
}

function AccountsTab() {
  const [owners, setOwners] = useState<AccountView[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<AccountView[]>('/api/admin/owners').then(setOwners, (err) => setError(errorMessage(err, 'Không tải được danh sách chủ sân')));
  }, []);

  return (
    <div className="page stack">
      <div className="page-head">
        <div>
          <h1>Tài khoản và đơn vị</h1>
          <p>Quản lý tài khoản chủ sân, cấu hình đơn vị, sân con và khóa tài khoản vi phạm.</p>
        </div>
      </div>

      <section className="panel card pad">
        <h2>Chủ sân</h2>
        {error && <p className="error" role="alert">{error}</p>}
        {owners.length === 0 && !error && (
          <EmptyState message="Chưa có chủ sân. Tạo chủ sân trước, rồi tạo đơn vị cho họ." />
        )}
        {owners.length > 0 && (
          <div className="table-scroll">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Chủ sân</th>
                  <th scope="col">Số điện thoại</th>
                  <th scope="col">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.id} className={o.lockedAt ? 'muted' : undefined}>
                    <td data-label="Chủ sân">
                      <span className="customer">{o.name}</span>
                    </td>
                    <td data-label="Số điện thoại">
                      <span className="phone tnum" data-field="phone">{o.phone}</span>
                    </td>
                    <td data-label="Trạng thái">
                      <span className={`tag ${o.lockedAt ? 'bad' : 'ok'}`}>
                        {o.lockedAt ? 'Đã khóa' : 'Hoạt động'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <OwnerForm onCreated={(o) => setOwners((list) => [...list, o].sort((a, b) => a.name.localeCompare(b.name, 'vi')))} />
      </section>
      <VenueAdmin owners={owners} />
      <AccountLock onChanged={(a) => setOwners((list) => list.map((o) => (o.id === a.id ? a : o)))} />
    </div>
  );
}

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
      setError(errorMessage(err, 'Không tạo được chủ sân'));
    }
  }

  return (
    <details className="drawer">
      <summary>Tạo chủ sân</summary>
      <form onSubmit={submit} className="stack-form">
        <div className="fgrid three">
          <label className="fld">
            <span>Tên chủ sân</span>
            <input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="fld">
            <span>Số điện thoại chủ sân</span>
            <input inputMode="tel" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <label className="fld">
            <span>Mật khẩu ban đầu</span>
            <input type="password" autoComplete="new-password" minLength={8} maxLength={128} aria-describedby="owner-password-hint"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
        </div>
        <p id="owner-password-hint" className="hint">Ít nhất 8 ký tự. Mỗi chủ sân một mật khẩu riêng. Đưa mật khẩu cho chủ sân qua kênh riêng.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn lime">Tạo chủ sân</button>
        </div>
      </form>
    </details>
  );
}
