'use client';

import { useMemo, useState } from 'react';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { Modal } from '@/components/Modal';
import { AdminUser, OrgUnit, UserRole } from '@/lib/types';
import {
  USER_ACCOUNT_STATUS_CLASS,
  USER_ACCOUNT_STATUS_LABEL,
  USER_ROLE_PILL_CLASS,
  USER_ROLE_PILL_LABEL,
  USER_SOURCE_CLASS,
  USER_SOURCE_LABEL,
} from '@/lib/status-labels';

const ROLES: UserRole[] = ['ADMIN', 'RISK_OWNER', 'AUDITOR', 'EXECUTIVE'];
const STATUSES: AdminUser['status'][] = ['ACTIVE', 'INVITED', 'DEACTIVATED'];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function formatLastLogin(value: string | null): string {
  if (!value) return 'Never';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function UsersAdminPage() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [orgUnitFilter, setOrgUnitFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const { data: orgUnits } = useApiGet<OrgUnit[]>('/org-units');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (roleFilter) params.set('role', roleFilter);
    if (orgUnitFilter) params.set('orgUnitId', orgUnitFilter);
    if (statusFilter) params.set('status', statusFilter);
    return params.toString();
  }, [search, roleFilter, orgUnitFilter, statusFilter]);

  const usersPath = `/users${query ? `?${query}` : ''}`;
  const { data: users, loading, setData } = useApiGet<AdminUser[]>(usersPath, [usersPath]);
  // Unfiltered, for the KPI row - always reflects the whole user base.
  const { data: allUsers } = useApiGet<AdminUser[]>('/users');

  const kpis = {
    active: allUsers?.filter((u) => u.status === 'ACTIVE').length ?? 0,
    invited: allUsers?.filter((u) => u.status === 'INVITED').length ?? 0,
    sso: allUsers?.filter((u) => u.source === 'ENTRA_SSO').length ?? 0,
    manual: allUsers?.filter((u) => u.source === 'MANUAL').length ?? 0,
  };

  function upsertLocal(updated: AdminUser) {
    setData((prev) => prev?.map((u) => (u.id === updated.id ? updated : u)) ?? prev);
  }

  return (
    <>
      <div className="topbar">
        <div className="page-title">Users</div>
      </div>

      <div className="content">
        <div className="kpi-chip-row">
          <div className="kpi-chip">
            <div className="kpi-num">{kpis.active}</div>
            <div className="kpi-chip-label">Active</div>
          </div>
          <div className="kpi-chip">
            <div className="kpi-num">{kpis.invited}</div>
            <div className="kpi-chip-label">Invited (pending)</div>
          </div>
          <div className="kpi-chip">
            <div className="kpi-num">{kpis.sso}</div>
            <div className="kpi-chip-label">Entra SSO</div>
          </div>
          <div className="kpi-chip">
            <div className="kpi-num">{kpis.manual}</div>
            <div className="kpi-chip-label">Manual accounts</div>
          </div>
        </div>

        <div className="card" style={{ padding: '14px 20px' }}>
          <div className="filter-bar">
            <div className="search-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <line x1="19" y1="19" x2="15.3" y2="15.3" />
              </svg>
              <input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="select">
              <option value="">Role: All</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {USER_ROLE_PILL_LABEL[r]}
                </option>
              ))}
            </select>
            <select value={orgUnitFilter} onChange={(e) => setOrgUnitFilter(e.target.value)} className="select">
              <option value="">Org unit: All</option>
              {orgUnits?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="select">
              <option value="">Status: All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {USER_ACCOUNT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setCreateOpen(true)} className="btn-primary">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New User
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {loading ? (
            <p className="helper-note" style={{ padding: 18 }}>
              Loading…
            </p>
          ) : !users || users.length === 0 ? (
            <p className="helper-note" style={{ padding: 18 }}>
              No users match the current filters.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="grc-table">
                <thead>
                  <tr>
                    <th style={{ width: '20%' }}>User</th>
                    <th>Role</th>
                    <th style={{ width: '22%' }}>Org Unit(s)</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th style={{ width: 100 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="owner-cell">
                          <div className="owner-avatar">{initials(u.name)}</div>
                          <div>
                            <div>{u.name}</div>
                            <div className="email-sub">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {u.role ? (
                          <span className={`role-pill ${USER_ROLE_PILL_CLASS[u.role]}`}>{USER_ROLE_PILL_LABEL[u.role]}</span>
                        ) : (
                          <span className="helper-note" style={{ margin: 0 }}>
                            Not yet assigned
                          </span>
                        )}
                      </td>
                      <td>
                        {u.role === 'ADMIN' ? (
                          <span className="tag">All org units</span>
                        ) : u.orgUnits.length === 0 ? (
                          '—'
                        ) : (
                          u.orgUnits.map((o) => (
                            <span key={o.id} className="tag">
                              {o.name}
                            </span>
                          ))
                        )}
                      </td>
                      <td>
                        <span className={`tag-source ${USER_SOURCE_CLASS[u.source]}`}>{USER_SOURCE_LABEL[u.source]}</span>
                      </td>
                      <td>
                        <span className={`status ${USER_ACCOUNT_STATUS_CLASS[u.status]}`}>{USER_ACCOUNT_STATUS_LABEL[u.status]}</span>
                      </td>
                      <td>{formatLastLogin(u.lastLoginAt)}</td>
                      <td>
                        <button type="button" className="btn-secondary" onClick={() => setEditingUser(u)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createOpen && orgUnits && (
        <CreateUserModal
          orgUnits={orgUnits}
          onClose={() => setCreateOpen(false)}
          onCreated={(u) => {
            setData((prev) => (prev ? [...prev, u] : [u]));
            setCreateOpen(false);
          }}
        />
      )}

      {editingUser && orgUnits && (
        <EditUserModal
          user={editingUser}
          orgUnits={orgUnits}
          onClose={() => setEditingUser(null)}
          onSaved={(u) => {
            upsertLocal(u);
            setEditingUser(null);
          }}
        />
      )}
    </>
  );
}

function OrgUnitCheckboxList({
  orgUnits,
  selected,
  onChange,
}: {
  orgUnits: OrgUnit[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="modal-list">
      {orgUnits.map((o) => {
        const checked = selected.includes(o.id);
        return (
          <div key={o.id} className="modal-list-row" onClick={() => onChange(checked ? selected.filter((id) => id !== o.id) : [...selected, o.id])}>
            <div className={`modal-checkbox${checked ? ' checked' : ''}`}>
              {checked && (
                <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
            <span className="modal-row-title">{o.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function CreateUserModal({
  orgUnits,
  onClose,
  onCreated,
}: {
  orgUnits: OrgUnit[];
  onClose: () => void;
  onCreated: (user: AdminUser) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('RISK_OWNER');
  const [password, setPassword] = useState('');
  const [orgUnitIds, setOrgUnitIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<AdminUser>('/users', {
        email,
        name,
        role,
        password: password || undefined,
        orgUnitIds,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="New User"
      subtitle="Creates the account ahead of time - status starts Invited until they first sign in (Entra ID, or the local password below)."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="create-user-form" disabled={submitting} className="btn-primary">
            {submitting ? 'Creating…' : 'Create User'}
          </button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label">Name</label>
          <input required className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Email</label>
          <input
            required
            type="email"
            className="input"
            style={{ fontFamily: 'var(--font-chrome)' }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label">Role</label>
          <select className="select-input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {USER_ROLE_PILL_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Local password (optional)</label>
          <input
            type="password"
            placeholder="Leave blank for an Entra SSO-only account"
            className="input"
            style={{ fontFamily: 'var(--font-chrome)' }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Org Unit(s)</label>
          <OrgUnitCheckboxList orgUnits={orgUnits} selected={orgUnitIds} onChange={setOrgUnitIds} />
        </div>
        {error && (
          <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

function EditUserModal({
  user,
  orgUnits,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  orgUnits: OrgUnit[];
  onClose: () => void;
  onSaved: (user: AdminUser) => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<UserRole | ''>(user.role ?? '');
  const [orgUnitIds, setOrgUnitIds] = useState<string[]>(user.orgUnits.map((o) => o.id));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const emailEditable = user.source === 'MANUAL';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.patch<AdminUser>(`/users/${user.id}`, {
        name,
        ...(emailEditable ? { email } : {}),
        ...(role ? { role } : {}),
        orgUnitIds,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus() {
    setTogglingStatus(true);
    setError(null);
    try {
      const action = user.status === 'DEACTIVATED' ? 'reactivate' : 'deactivate';
      const updated = await api.post<AdminUser>(`/users/${user.id}/${action}`);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account status');
    } finally {
      setTogglingStatus(false);
    }
  }

  return (
    <Modal
      title="Edit User"
      subtitle={user.email}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-danger-text" disabled={togglingStatus} onClick={toggleStatus}>
            {togglingStatus ? 'Working…' : user.status === 'DEACTIVATED' ? 'Reactivate Account' : 'Deactivate Account'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-user-form" disabled={submitting} className="btn-primary">
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field-label">Name</label>
          <input required className="input" style={{ fontFamily: 'var(--font-chrome)' }} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Email</label>
          <input
            required
            type="email"
            className="input"
            style={{ fontFamily: 'var(--font-chrome)' }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!emailEditable}
          />
          {!emailEditable && <div className="helper-note">Entra SSO-provisioned - email must match the Entra ID account and can&apos;t be changed here.</div>}
        </div>
        <div className="field">
          <label className="field-label">Role</label>
          <select className="select-input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
            {!role && <option value="">Not yet assigned</option>}
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {USER_ROLE_PILL_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Org Unit(s)</label>
          <OrgUnitCheckboxList orgUnits={orgUnits} selected={orgUnitIds} onChange={setOrgUnitIds} />
        </div>
        {error && (
          <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
