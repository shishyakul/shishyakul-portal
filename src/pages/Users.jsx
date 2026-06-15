// Users Management Page — Admin can create, view, and manage all users
import { useState, useEffect } from 'react';
import {
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

const ROLES = ['admin', 'teacher', 'student'];

function AddUserModal({ onClose, onSaved }) {
  const [form, setForm]     = useState({ email: '', fullName: '', role: 'student', uid: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    if (!form.uid.trim() || !form.email.trim() || !form.fullName.trim()) {
      setError('All fields are required. UID comes from Firebase Auth Users tab.');
      return;
    }
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', form.uid.trim()), {
        email:     form.email.trim(),
        fullName:  form.fullName.trim(),
        role:      form.role,
        createdAt: serverTimestamp(),
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <h2 className="modal-title">Add New User</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          First create the user in <strong>Firebase Console → Authentication → Users</strong>,
          then paste their UID here to link their profile.
        </p>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10, padding: '10px 14px', fontSize: 13,
            color: 'var(--status-error)', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Firebase UID *</label>
          <input
            className="portal-input"
            placeholder="e.g. abc123XYZ..."
            value={form.uid}
            onChange={e => setForm(f => ({ ...f, uid: e.target.value }))}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input
            className="portal-input"
            placeholder="e.g. Himanshu Sharma"
            value={form.fullName}
            onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Email Address *</label>
          <input
            className="portal-input"
            type="email"
            placeholder="user@shishyakul.in"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Role *</label>
          <select
            className="portal-select"
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
          >
            {ROLES.map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-brand" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : 'Add User'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm]     = useState({ fullName: user.fullName, role: user.role });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.id), { fullName: form.fullName, role: form.role });
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <h2 className="modal-title">Edit User</h2>
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input className="portal-input" value={form.fullName}
            onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="portal-select" value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {ROLES.map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-brand" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ROLE_BADGE = { admin: 'badge-admin', teacher: 'badge-teacher', student: 'badge-student' };

export default function Users() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [editUser, setEditUser]   = useState(null);
  const [search, setSearch]       = useState('');
  const [filterRole, setFilter]   = useState('all');
  const [deleting, setDeleting]   = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'users'));
    setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (uid, name) => {
    if (!window.confirm(`Delete "${name}"? This removes their portal profile. They can still be deleted from Firebase Auth separately.`)) return;
    setDeleting(uid);
    await deleteDoc(doc(db, 'users', uid));
    setUsers(prev => prev.filter(u => u.id !== uid));
    setDeleting(null);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchRole   = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <div>
      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSaved={fetchUsers} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={fetchUsers} />}

      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage all admins, teachers, and students</p>
        </div>
        <button className="btn btn-brand" onClick={() => setShowAdd(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_add</span>
          Add User
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          className="portal-input"
          style={{ maxWidth: 280 }}
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="portal-select" style={{ maxWidth: 160 }}
          value={filterRole} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Roles</option>
          {ROLES.map(r => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="material-symbols-outlined">group_off</span>
            <p>{search || filterRole !== 'all' ? 'No users match your filter.' : 'No users yet. Click "Add User" to get started.'}</p>
          </div>
        ) : (
          <table className="portal-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>UID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(253,180,42,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontWeight: 700,
                        fontSize: 13, color: 'var(--brand-primary)',
                      }}>
                        {(u.fullName?.[0] ?? '?').toUpperCase()}
                      </div>
                      {u.fullName || '—'}
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td><span className={`badge ${ROLE_BADGE[u.role] ?? 'badge-student'}`}>{u.role}</span></td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {u.id.slice(0, 12)}…
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditUser(u)}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(u.id, u.fullName)}
                        disabled={deleting === u.id}
                      >
                        {deleting === u.id
                          ? <span className="spinner" style={{ width: 14, height: 14 }} />
                          : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
