// Users Management Page — Admin can create, view, and manage all users
import { useState, useEffect } from 'react';
import {
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, arrayUnion
} from 'firebase/firestore';
import { db } from '../firebase';
import { BATCH_DEF } from './Batches';

const ROLES = ['teacher'];
const SUBJECTS = ['Mathematics', 'Science', 'SST', 'English', 'Hindi', 'Marathi', 'Sanskrit', 'Physics', 'Chemistry', 'Biology', 'Computer', 'Economics', 'Accounts'];
const TARGETS = [
  '100% syllabus completion by Dec',
  'Maintain 85% average test score',
  'Zero parent complaints',
  '100% attendance rate',
  'Monthly PTM Reports'
];

const formatRole = (role) => {
  return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

function AddUserModal({ onClose, onSaved }) {
  const [form, setForm]     = useState({ email: '', fullName: '', mobile: '', role: 'teacher', password: '', joiningDate: '', cvLink: '', subjects: [], classTeacherBatch: '', yearlyTarget: [], assignedBatches: [] });
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
        joiningDate: form.joiningDate,
        cvLink:    form.cvLink.trim(),
        subjects:  form.subjects.join(', '),
        classTeacherBatch: form.classTeacherBatch,
        yearlyTarget: form.yearlyTarget.join(' | '),
        assignedBatches: form.assignedBatches,
        temporaryPassword: form.password,
        createdAt: serverTimestamp(),
      });

      // 3. Send Email via Webhook
      try {
        const appScriptUrl = import.meta.env.VITE_APP_SCRIPT_URL;
        if (appScriptUrl) {
          const portalName = form.role === 'teacher' ? 'Faculty Portal' : 'Management Portal';
          const emailBody = `Dear ${form.fullName.trim()},\n\nYour ${portalName} has been generated.\n\nPortal Link: https://portal.shishyakul.in/login\nLogin Email: ${form.email.trim()}\nTemporary Password: ${form.password}\n\nRegards,\nShishyakul Administration`;
          await fetch(appScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send_dynamic_email',
              to: form.email.trim(),
              subject: `Shishyakul ${portalName} Access`,
              body: emailBody
            })
          });
          alert(`User created successfully and welcome email dispatched!`);
        } else {
          alert(`User created successfully! (Welcome email skipped because VITE_APP_SCRIPT_URL is missing)`);
        }
      } catch (e) {
        console.error("Email error:", e);
        alert(`User created, but failed to dispatch welcome email.`);
      }

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
      <div className="modal-box" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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
                <option key={r} value={r}>{formatRole(r)}</option>
              ))}
            </select>
          </div>
        </div>

        {form.role === 'teacher' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div className="form-group">
                <label className="form-label">Joining Date</label>
                <input className="portal-input" type="date" value={form.joiningDate} onChange={e => setForm(f => ({...f, joiningDate: e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">CV / Resume Link</label>
                <input className="portal-input" type="url" placeholder="Google Drive Link..." value={form.cvLink} onChange={e => setForm(f => ({...f, cvLink: e.target.value}))} />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Assigned Subjects</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SUBJECTS.map(sub => {
                  const isSelected = form.subjects.includes(sub);
                  return (
                    <div 
                      key={sub} 
                      onClick={() => setForm(f => ({
                        ...f, 
                        subjects: isSelected ? f.subjects.filter(s => s !== sub) : [...f.subjects, sub]
                      }))}
                      style={{ 
                        padding: '4px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
                        background: isSelected ? 'var(--brand-primary)' : 'var(--surface-bg)',
                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--surface-border)'}`,
                        userSelect: 'none'
                      }}
                    >
                      {sub}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Assigned Batches (Teaches in)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.values(BATCH_DEF).flat().map(b => {
                  const isSelected = form.assignedBatches.includes(b.id);
                  return (
                    <div 
                      key={b.id} 
                      onClick={() => setForm(f => ({
                        ...f, 
                        assignedBatches: isSelected ? f.assignedBatches.filter(s => s !== b.id) : [...f.assignedBatches, b.id]
                      }))}
                      style={{ 
                        padding: '4px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
                        background: isSelected ? 'var(--brand-primary)' : 'var(--surface-bg)',
                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--surface-border)'}`,
                        userSelect: 'none'
                      }}
                    >
                      {b.id}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Class Teacher Of (Batch)</label>
              <select 
                className="portal-select" 
                value={form.classTeacherBatch} 
                onChange={e => setForm(f => ({...f, classTeacherBatch: e.target.value}))}
              >
                <option value="">None (Optional)</option>
                {Object.values(BATCH_DEF).flat().map(b => (
                  <option key={b.id} value={b.id}>{b.id}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Yearly Targets</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-bg)', padding: 12, borderRadius: 8, border: '1px solid var(--surface-border)' }}>
                {TARGETS.map(target => (
                  <label key={target} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={form.yearlyTarget.includes(target)}
                      onChange={e => {
                        const isChecked = e.target.checked;
                        setForm(f => ({
                          ...f,
                          yearlyTarget: isChecked 
                            ? [...f.yearlyTarget, target] 
                            : f.yearlyTarget.filter(t => t !== target)
                        }));
                      }}
                    />
                    {target}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="modal-footer" style={{ marginTop: 24 }}>
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
    role: user.role || 'teacher', 
    password: '',
    subjects: user.subjects ? user.subjects.split(',').map(s => s.trim()).filter(Boolean) : [],
    classTeacherBatch: user.classTeacherBatch || '',
    assignedBatches: user.assignedBatches || [],
    yearlyTarget: user.yearlyTarget ? user.yearlyTarget.split('|').map(s => s.trim()).filter(Boolean) : []
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
      const updateData = {
        fullName: form.fullName, 
        email: form.email,
        mobile: form.mobile,
        role: form.role 
      };
      
      if (form.role === 'teacher') {
        updateData.subjects = form.subjects.join(', ');
        updateData.classTeacherBatch = form.classTeacherBatch;
        updateData.assignedBatches = form.assignedBatches;
        updateData.yearlyTarget = form.yearlyTarget.join(' | ');
      }

      await updateDoc(doc(db, 'users', user.id), updateData);

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
      <div className="modal-box" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
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
                <option key={r} value={r}>{formatRole(r)}</option>
              ))}
            </select>
          </div>
        </div>

        {form.role === 'teacher' && (
          <>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Assigned Subjects</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {SUBJECTS.map(sub => {
                  const isSelected = form.subjects.includes(sub);
                  return (
                    <div 
                      key={sub} 
                      onClick={() => setForm(f => ({
                        ...f, 
                        subjects: isSelected ? f.subjects.filter(s => s !== sub) : [...f.subjects, sub]
                      }))}
                      style={{ 
                        padding: '4px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
                        background: isSelected ? 'var(--brand-primary)' : 'var(--surface-bg)',
                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--surface-border)'}`,
                        userSelect: 'none'
                      }}
                    >
                      {sub}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Assigned Batches (Teaches in)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.values(BATCH_DEF).flat().map(b => {
                  const isSelected = form.assignedBatches.includes(b.id);
                  return (
                    <div 
                      key={b.id} 
                      onClick={() => setForm(f => ({
                        ...f, 
                        assignedBatches: isSelected ? f.assignedBatches.filter(s => s !== b.id) : [...f.assignedBatches, b.id]
                      }))}
                      style={{ 
                        padding: '4px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
                        background: isSelected ? 'var(--brand-primary)' : 'var(--surface-bg)',
                        color: isSelected ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--surface-border)'}`,
                        userSelect: 'none'
                      }}
                    >
                      {b.id}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Class Teacher Of (Batch)</label>
              <select 
                className="portal-select" 
                value={form.classTeacherBatch} 
                onChange={e => setForm(f => ({...f, classTeacherBatch: e.target.value}))}
              >
                <option value="">None (Optional)</option>
                {Object.values(BATCH_DEF).flat().map(b => (
                  <option key={b.id} value={b.id}>{b.id}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginTop: 12 }}>
              <label className="form-label">Yearly Targets</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface-bg)', padding: 12, borderRadius: 8, border: '1px solid var(--surface-border)' }}>
                {TARGETS.map(target => (
                  <label key={target} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={form.yearlyTarget.includes(target)}
                      onChange={e => {
                        const isChecked = e.target.checked;
                        setForm(f => ({
                          ...f,
                          yearlyTarget: isChecked 
                            ? [...f.yearlyTarget, target] 
                            : f.yearlyTarget.filter(t => t !== target)
                        }));
                      }}
                    />
                    {target}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

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

function FeedbackModal({ teacher, onClose, onSaved }) {
  const [rating, setRating] = useState(0);
  const [impression, setImpression] = useState('');
  const [review, setReview] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [weeklyTargets, setWeeklyTargets] = useState(['']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleTargetChange = (index, value) => {
    const newTargets = [...weeklyTargets];
    newTargets[index] = value;
    setWeeklyTargets(newTargets);
  };

  const addTarget = () => setWeeklyTargets([...weeklyTargets, '']);
  const removeTarget = (index) => setWeeklyTargets(weeklyTargets.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (rating === 0 || !impression || !review.trim()) {
      setError('Please provide a rating, impression, and detailed review.');
      return;
    }
    setSaving(true);
    try {
      const validTargets = weeklyTargets.filter(t => t.trim() !== '');
      const fbData = {
        date: new Date().toISOString(),
        rating,
        impression,
        review: review.trim(),
        focusArea: focusArea.trim(),
        targets: validTargets,
        managerId: 'Service Manager'
      };
      
      const targetObjects = validTargets.map((t, i) => ({ id: `wt_${Date.now()}_${i}`, title: t, completed: false }));

      await updateDoc(doc(db, 'users', teacher.id), {
        managerFeedbacks: arrayUnion(fbData),
        currentWeeklyTargets: targetObjects
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
      <div className="modal-box" style={{ maxWidth: 600 }}>
        <h2 className="modal-title">Submit Weekly Feedback</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Providing feedback for <strong>{teacher.fullName}</strong>
        </p>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px', fontSize: 13, color: 'var(--status-error)', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Performance Rating (1-5 Stars)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1,2,3,4,5].map(star => (
              <span 
                key={star} 
                onClick={() => setRating(star)} 
                className="material-symbols-outlined" 
                style={{ fontSize: 32, cursor: 'pointer', color: star <= rating ? '#fbc02d' : '#e0e0e0', transition: 'color 0.2s' }}
              >
                star
              </span>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">General Impressions</label>
          <select className="portal-select" value={impression} onChange={e => setImpression(e.target.value)}>
            <option value="">Select Impression...</option>
            <option value="Needs Improvement">Needs Improvement</option>
            <option value="Meeting Expectations">Meeting Expectations</option>
            <option value="Exceeding Expectations">Exceeding Expectations</option>
            <option value="Outstanding">Outstanding</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Detailed Review</label>
          <textarea className="portal-input" style={{ minHeight: 80 }} placeholder="Write your professional feedback here..." value={review} onChange={e => setReview(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Areas of Focus (Next Week)</label>
          <textarea className="portal-input" style={{ minHeight: 60 }} placeholder="What should the teacher focus on next week?" value={focusArea} onChange={e => setFocusArea(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Next Weekly Targets (Checklist)</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={addTarget} style={{ padding: '4px 8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Add Checkpoint
            </button>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {weeklyTargets.map((target, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)' }}>check_box_outline_blank</span>
                <input 
                  type="text" 
                  className="portal-input" 
                  placeholder="e.g. Conduct chapter 4 revision test" 
                  value={target} 
                  onChange={(e) => handleTargetChange(idx, e.target.value)}
                  style={{ flex: 1 }}
                />
                {weeklyTargets.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeTarget(idx)} style={{ color: 'var(--status-error)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>delete</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-brand" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" /> Submitting…</> : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ROLE_BADGE = { 
  admin: 'badge-admin', 
  branch_manager: 'badge-branch-manager', 
  service_manager: 'badge-service-manager', 
  front_desk_manager: 'badge-front-desk',
  inventory_manager: 'badge-inventory-manager',
  teacher: 'badge-brand'
};

export default function Users() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [editUser, setEditUser]   = useState(null);
  const [search, setSearch]       = useState('');
  const [filterRole, setFilter]   = useState('all');
  const [deleteUser, setDeleteUser] = useState(null);
  const [feedbackUser, setFeedbackUser] = useState(null);

  const isSunday = new Date().getDay() === 0;

  const getTeacherScore = (teacher) => {
    let baseScore = 65; // base points representing average attendance, tasks, and syllabus
    if (teacher.managerFeedbacks && teacher.managerFeedbacks.length > 0) {
      const totalStars = teacher.managerFeedbacks.reduce((acc, fb) => acc + (fb.rating || 0), 0);
      const avgStars = totalStars / teacher.managerFeedbacks.length;
      baseScore += (avgStars / 5) * 35; // up to 35 points based on feedback
    } else {
       baseScore += 15; // default 15 points if no feedback yet
    }
    return Math.min(100, Math.round(baseScore));
  };

  const fetchUsers = async () => {
    setLoading(true);
    // Fetch only teachers and limit to 50 for scale (Core team is hidden)
    const { query, where, limit } = await import('firebase/firestore');
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'), limit(50));
    const snap = await getDocs(q);
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
      {feedbackUser && <FeedbackModal teacher={feedbackUser} onClose={() => setFeedbackUser(null)} onSaved={fetchUsers} />}

      {isSunday && (
        <div style={{ background: 'linear-gradient(135deg, #fff3e0, #ffe0b2)', border: '1px solid #ffcc80', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, boxShadow: '0 4px 12px rgba(230,81,0,0.05)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#e65100' }}>event_note</span>
          <div>
            <h3 style={{ margin: 0, color: '#e65100', fontSize: 16 }}>Weekly Teacher Review Day</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#f57c00' }}>It's Sunday! Please submit your weekly performance feedback and ratings for all active teachers.</p>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="page-subtitle">Manage Institute Teachers and generate temporary credentials</p>
        </div>
        <button className="btn btn-brand" onClick={() => setShowAdd(true)}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_add</span>
          Add Teacher
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
            <option key={r} value={r}>{formatRole(r)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div style={{ marginTop: 20 }}>
        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="material-symbols-outlined">group_off</span>
            <p>{search || filterRole !== 'all' ? 'No users match your filter.' : 'No users yet. Click "Add User" to get started.'}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
            {filtered.map(u => {
              const score = getTeacherScore(u);
              return (
                <div key={u.id} className="portal-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(253,180,42,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-display)', fontWeight: 700,
                        fontSize: 18, color: 'var(--brand-primary)',
                      }}>
                        {(u.fullName?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.fullName || '—'}>{u.fullName || '—'}</h3>
                        <p style={{ margin: '2px 0 0 0', fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={u.email}>{u.email}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                      <span style={{ display: 'block', fontSize: 20, fontWeight: 900, color: score >= 80 ? '#2e7d32' : score >= 60 ? '#f57f17' : '#c62828' }}>
                        {score}<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/100</span>
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Perf Score</span>
                    </div>
                  </div>
                  
                  <div style={{ background: 'var(--surface-bg)', padding: 12, borderRadius: 8, border: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Role:</span>
                      <span className={`badge ${ROLE_BADGE[u.role] ?? 'badge-service-manager'}`}>{formatRole(u.role)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Credentials:</span>
                      {u.temporaryPassword ? (
                        <button 
                          className="btn btn-ghost btn-sm" 
                          onClick={() => navigator.clipboard.writeText(u.temporaryPassword)}
                          style={{ fontSize: 11, color: 'var(--brand-primary)', background: 'rgba(253,180,42,0.1)', padding: '4px 8px' }}
                          title="Copy password to clipboard"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 4 }}>content_copy</span>
                          Copy
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Securely Hashed</span>
                      )}
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--surface-border)' }}>
                    <button 
                      className="btn btn-sm" 
                      onClick={() => setFeedbackUser(u)}
                      style={{ flex: 1, background: isSunday ? '#e65100' : 'var(--brand-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, border: 'none' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>reviews</span>
                      Feedback
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditUser(u)} style={{ flex: 1, justifyContent: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteUser(u)} style={{ padding: '0 12px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
