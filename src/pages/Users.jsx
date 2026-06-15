// Users Management Page — Admin can create, view, and manage all users
import { useState, useEffect } from 'react';
import {
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

const ROLES = ['admin', 'teacher', 'student'];

function AddUserModal({ onClose, onSaved }) {
  const [form, setForm]     = useState({ email: '', fullName: '', mobile: '', role: 'student', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    if (!form.email.trim() || !form.fullName.trim() || !form.password.trim()) {
      setError('Name, Email, and Password are required.');
      return;
    }
    setSaving(true);
    setError('');
    
    try {
      // 1. Create User in Firebase Auth via REST API to avoid signing out the current admin
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          returnSecureToken: true
        })
      });

      const authData = await authRes.json();
      
      if (!authRes.ok || authData.error) {
        throw new Error(authData.error?.message || 'Failed to create user account');
      }

      const newUid = authData.localId;

      // 2. Save User Profile in Firestore
      await setDoc(doc(db, 'users', newUid), {
        email:     form.email.trim(),
        fullName:  form.fullName.trim(),
        mobile:    form.mobile.trim(),
        role:      form.role,
        createdAt: serverTimestamp(),
      });

      onSaved();
      onClose();
    } catch (e) {
      let msg = e.message;
      if (msg.includes('EMAIL_EXISTS')) msg = 'This email address is already in use by another account.';
      if (msg.includes('WEAK_PASSWORD')) msg = 'Password should be at least 6 characters.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <h2 className="modal-title">Add New User</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          Create an account and assign a role. You can share these credentials with the user to let them log in.
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
          <label className="form-label">Full Name *</label>
          <input
            className="portal-input"
            placeholder="e.g. Himanshu Sharma"
            value={form.fullName}
            onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
          />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
            <label className="form-label">Mobile Number</label>
            <input
              className="portal-input"
              type="tel"
              placeholder="+91..."
              value={form.mobile}
              onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Temporary Password *</label>
            <input
              className="portal-input"
              type="text"
              placeholder="Min. 6 characters"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
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
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-brand" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" /> Creating…</> : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [form, setForm]     = useState({ 
    fullName: user.fullName || '', 
    email: user.email || '', 
    mobile: user.mobile || '', 
    role: user.role || 'student', 
    password: '' 
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async () => {
    if (!form.email.trim() || !form.fullName.trim()) {
      setError('Name and Email are required.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      // 1. If email, password, or name changed, update Firebase Auth via our secure API
      if (form.email !== user.email || form.password || form.fullName !== user.fullName) {
        // In local dev, vite proxies /api to localhost:3000
        const isLocal = window.location.hostname === 'localhost';
        const apiUrl = isLocal ? 'http://localhost:3000/api/manageUser' : '/api/manageUser';
        
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: user.id,
            email: form.email !== user.email ? form.email : undefined,
            password: form.password ? form.password : undefined,
            fullName: form.fullName !== user.fullName ? form.fullName : undefined
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update Auth credentials');
      }

      // 2. Update Firestore profile
      await updateDoc(doc(db, 'users', user.id), { 
        fullName: form.fullName, 
        email: form.email,
        mobile: form.mobile,
        role: form.role 
      });

      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <h2 className="modal-title">Edit User</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Changes to email or password will take effect immediately.
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
          <label className="form-label">Full Name</label>
          <input className="portal-input" value={form.fullName}
            onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="portal-input" type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <input className="portal-input" type="tel" value={form.mobile}
              onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Set New Password</label>
            <input className="portal-input" type="text" placeholder="Leave blank to keep current" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
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

function DeleteUserModal({ user, onClose, onSaved }) {
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Soft Delete: Mark as inactive instead of deleting the document
      await updateDoc(doc(db, 'users', user.id), { isActive: false });
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <h2 className="modal-title" style={{ color: 'var(--status-error)' }}>Delete User</h2>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          <p>Are you absolutely sure you want to delete <strong>{user.fullName}</strong>?</p>
          <p style={{ marginTop: 8, padding: 10, background: 'rgba(253,180,42,0.1)', borderRadius: 8, color: 'var(--brand-primary)' }}>
            <strong>Note:</strong> This will remove the user from the active portal, but their profile records will remain safely saved in the database.
          </p>
        </div>

        <div className="form-group">
          <label className="form-label">Please type <strong>{user.fullName}</strong> to confirm.</label>
          <input className="portal-input" value={confirmName}
            onChange={e => setConfirmName(e.target.value)} />
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={deleting}>Cancel</button>
          <button 
            className="btn btn-danger" 
            onClick={handleDelete} 
            disabled={deleting || confirmName !== user.fullName}
          >
            {deleting ? <><span className="spinner" /> Deleting…</> : 'I understand, delete user'}
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
  const [deleteUser, setDeleteUser] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    const snap = await getDocs(collection(db, 'users'));
    setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u => {
    if (u.isActive === false) return false; // Filter out soft-deleted users
    
    const q = search.toLowerCase();
    const matchSearch = !q || u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchRole   = filterRole === 'all' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <div>
      {showAdd && <AddUserModal onClose={() => setShowAdd(false)} onSaved={fetchUsers} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={fetchUsers} />}
      {deleteUser && <DeleteUserModal user={deleteUser} onClose={() => setDeleteUser(null)} onSaved={fetchUsers} />}

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
                        onClick={() => setDeleteUser(u)}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
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
