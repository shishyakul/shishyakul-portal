import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { createPortal } from 'react-dom';

export default function TabProfile({ student }) {
  const { profile } = useAuth();
  const isServiceManager = profile?.role === 'service_manager' || profile?.role === 'admin';
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...student });
  const [saving, setSaving] = useState(false);
  const [generatingPortal, setGeneratingPortal] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, 'students', student.id);
      await updateDoc(docRef, {
        dob: formData.dob || '',
        gender: formData.gender || '',
        aadharNo: formData.aadharNo || '',
        contactNo: formData.contactNo || '',
        emailId: formData.emailId || '',
        address: formData.address || '',
        schoolName: formData.schoolName || '',
        standard: formData.standard || '',
        board: formData.board || '',
        preferredSlot: formData.preferredSlot || '',
        describeSelf: formData.describeSelf || '',
        passions: formData.passions || '',
        careerGoals: formData.careerGoals || '',
        medicalConditions: formData.medicalConditions || '',
        emergencyContact: formData.emergencyContact || '',
        siblingLink: formData.siblingLink || '',
        fatherName: formData.fatherName || '',
        motherName: formData.motherName || '',
        fatherContact: formData.fatherContact || '',
        motherContact: formData.motherContact || '',
        fatherOccupation: formData.fatherOccupation || '',
        motherOccupation: formData.motherOccupation || '',
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update profile", err);
      alert("Failed to update profile details.");
    }
    setSaving(false);
  };

  const handleGeneratePortal = async () => {
    if (!student.emailId) {
      alert("This student doesn't have an email address recorded. Please edit the profile and add an Email ID first.");
      return;
    }
    if (!student.batch) {
      alert("Please allocate a batch to this student from the Batch Allocation page before generating the portal.");
      return;
    }

    if (!window.confirm(`Generate portal access for ${student.studentName} and email credentials to ${student.emailId}?`)) return;

    setGeneratingPortal(true);
    try {
      // 1. Generate secure password (8 chars)
      const randomPass = Math.random().toString(36).slice(-8) + 'Shishyakul@1';
      
      // 2. Create Auth Account
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: student.emailId.trim(), password: randomPass, returnSecureToken: true })
      });
      const authData = await authRes.json();
      if (!authRes.ok || authData.error) throw new Error(authData.error?.message || 'Failed to create student account');
      const newUid = authData.localId;

      // 3. Create users document for role routing
      await setDoc(doc(db, 'users', newUid), {
        email: student.emailId.trim(),
        fullName: student.studentName,
        mobile: student.contactNo || '',
        role: 'student',
        studentId: student.id,
        batch: student.batch,
        createdAt: serverTimestamp(),
      });

      // 4. Update student document
      await updateDoc(doc(db, 'students', student.id), {
        portalGenerated: true,
        portalUid: newUid,
        portalPassword: randomPass
      });

      // 5. Send Email via Google Apps Script Webhook
      const appScriptUrl = import.meta.env.VITE_APP_SCRIPT_URL;
      if (appScriptUrl) {
        const emailBody = `Dear Parent / Guardian,

We are delighted to welcome ${student.studentName} to Shishyakul!
Their personalized Student Academic Portal has been successfully generated. 

You and your child can log in to view timetables, access course materials, submit assignments, and track performance.

Portal Link: https://shishyakul.in/login
Login Email: ${student.emailId.trim()}
Temporary Password: ${randomPass}

Please keep these credentials secure.

Warm Regards,
Shishyakul Administration`;

        await fetch(appScriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_dynamic_email',
            to: student.emailId.trim(),
            subject: `Welcome to Shishyakul - Portal Access Details for ${student.studentName}`,
            body: emailBody
          })
        });
        alert("Portal generated successfully! Welcome email has been dispatched to the parent.");
      } else {
        alert("Portal generated successfully! (Note: Welcome email was NOT sent because VITE_APP_SCRIPT_URL is missing in your .env file).");
      }
    } catch (err) {
      console.error(err);
      let msg = err.message;
      if (msg.includes('EMAIL_EXISTS')) {
        alert("An account with this email already exists in Firebase Auth. Automatically marking this student's portal as active.");
        await updateDoc(doc(db, 'students', student.id), {
          portalGenerated: true,
          portalPassword: 'Hidden (Pre-existing account)'
        });
      } else {
        alert(`Failed to generate portal: ${msg}`);
      }
    } finally {
      setGeneratingPortal(false);
    }
  };

  const actionsPortal = document.getElementById('sd-profile-actions-portal');

  return (
    <div className="sd-profile-body">
      {isServiceManager && actionsPortal && createPortal(
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          {isEditing ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-ghost" onClick={() => { setIsEditing(false); setFormData({ ...student }); }}>Cancel</button>
              <button className="btn-brand" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              {!student.portalGenerated && (student.status === 'Admitted' || student.status === 'admitted') && (
                <button className="btn-brand" onClick={handleGeneratePortal} disabled={generatingPortal} style={{ background: 'var(--brand-primary)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>vpn_key</span>
                  {generatingPortal ? 'Generating...' : 'Generate Portal Access'}
                </button>
              )}
              {student.portalGenerated && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--surface-bg)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--surface-border)', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-success)', fontWeight: 600, marginBottom: '2px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                    Portal Active
                  </div>
                  <div><strong>Email:</strong> {student.emailId}</div>
                  <div><strong>Pass:</strong> {student.portalPassword || 'Hidden'}</div>
                </div>
              )}
              <button className="btn-ghost" onClick={() => setIsEditing(true)}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span> Edit Profile
              </button>
            </div>
          )}
        </div>,
        actionsPortal
      )}

      {/* Personal Details */}
      <div className="sd-section">
        <h3 className="sd-section-title">
          <span className="material-symbols-outlined">badge</span>
          Personal Details
        </h3>
        <div className="sd-grid-3">
          <div className="sd-field">
            <span className="sd-field-label">Date of Birth</span>
            {isEditing ? <input type="date" value={formData.dob || ''} onChange={e => handleChange('dob', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.dob || '-'}</span>}
          </div>
          <div className="sd-field">
            <span className="sd-field-label">Gender</span>
            {isEditing ? <input value={formData.gender || ''} onChange={e => handleChange('gender', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.gender || '-'}</span>}
          </div>
          <div className="sd-field">
            <span className="sd-field-label">Aadhar Card</span>
            {isEditing ? <input value={formData.aadharNo || ''} onChange={e => handleChange('aadharNo', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.aadharNo || '-'}</span>}
          </div>
          <div className="sd-field">
            <span className="sd-field-label">Contact Number</span>
            {isEditing ? <input value={formData.contactNo || ''} onChange={e => handleChange('contactNo', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.contactNo || '-'}</span>}
          </div>
          <div className="sd-field">
            <span className="sd-field-label">Email ID</span>
            {isEditing ? <input value={formData.emailId || ''} onChange={e => handleChange('emailId', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.emailId || '-'}</span>}
          </div>
          <div className="sd-field">
            <span className="sd-field-label">Address</span>
            {isEditing ? <input value={formData.address || ''} onChange={e => handleChange('address', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.address || '-'}</span>}
          </div>
        </div>
      </div>

      {/* Academic & Bio Details */}
      <div className="sd-section">
        <h3 className="sd-section-title">
          <span className="material-symbols-outlined">local_library</span>
          Academic & Bio
        </h3>
        <div className="sd-grid-3">
          <div className="sd-field">
            <span className="sd-field-label">School Name</span>
            {isEditing ? <input value={formData.schoolName || ''} onChange={e => handleChange('schoolName', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.schoolName || '-'}</span>}
          </div>
          <div className="sd-field">
            <span className="sd-field-label">Standard</span>
            {isEditing ? <input value={formData.standard || ''} onChange={e => handleChange('standard', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.standard || '-'}</span>}
          </div>
          <div className="sd-field">
            <span className="sd-field-label">Board</span>
            {isEditing ? <input value={formData.board || ''} onChange={e => handleChange('board', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.board || '-'}</span>}
          </div>
        </div>
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="sd-field">
            <span className="sd-field-label">Describe Yourself</span>
            {isEditing ? <textarea value={formData.describeSelf || ''} onChange={e => handleChange('describeSelf', e.target.value)} className="portal-input" style={{ width: '100%', minHeight: '60px' }} /> : <span className="sd-field-value">{student.describeSelf || '-'}</span>}
          </div>
          <div className="sd-grid-2">
            <div className="sd-field">
              <span className="sd-field-label">Passions</span>
              {isEditing ? <input value={formData.passions || ''} onChange={e => handleChange('passions', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.passions || '-'}</span>}
            </div>
            <div className="sd-field">
              <span className="sd-field-label">Career Goals</span>
              {isEditing ? <input value={formData.careerGoals || ''} onChange={e => handleChange('careerGoals', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.careerGoals || '-'}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Emergency & Guardian Details */}
      <div className="sd-section">
        <h3 className="sd-section-title">
          <span className="material-symbols-outlined">family_restroom</span>
          Guardian & Emergency Contacts
        </h3>
        <div className="sd-grid-2" style={{ marginBottom: '16px', background: 'var(--surface-bg)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--surface-border)' }}>
          <div className="sd-field">
            <span className="sd-field-label" style={{ color: 'var(--status-error)' }}>Emergency Contact Number</span>
            {isEditing ? <input value={formData.emergencyContact || ''} onChange={e => handleChange('emergencyContact', e.target.value)} className="portal-input" placeholder="Relation & Number" /> : <span className="sd-field-value">{student.emergencyContact || '-'}</span>}
          </div>
          <div className="sd-field">
            <span className="sd-field-label" style={{ color: 'var(--status-error)' }}>Medical Conditions / Allergies</span>
            {isEditing ? <input value={formData.medicalConditions || ''} onChange={e => handleChange('medicalConditions', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.medicalConditions || 'None'}</span>}
          </div>
          <div className="sd-field" style={{ gridColumn: 'span 2', marginTop: '8px' }}>
            <span className="sd-field-label">Sibling Link (Brother/Sister in Shishyakul)</span>
            {isEditing ? <input value={formData.siblingLink || ''} onChange={e => handleChange('siblingLink', e.target.value)} className="portal-input" placeholder="e.g. Rahul Sharma (12th Sci)" /> : <span className="sd-field-value">{student.siblingLink || '-'}</span>}
          </div>
        </div>

        <div className="sd-grid-2">
          <div className="sd-field">
            <span className="sd-field-label">Father's Name</span>
            {isEditing ? <input value={formData.fatherName || ''} onChange={e => handleChange('fatherName', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.fatherName || '-'}</span>}
          </div>
          <div className="sd-field">
            <span className="sd-field-label">Mother's Name</span>
            {isEditing ? <input value={formData.motherName || ''} onChange={e => handleChange('motherName', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.motherName || '-'}</span>}
          </div>
          <div className="sd-field">
            <span className="sd-field-label">Father's Contact</span>
            {isEditing ? <input value={formData.fatherContact || ''} onChange={e => handleChange('fatherContact', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.fatherContact || '-'}</span>}
          </div>
          <div className="sd-field">
            <span className="sd-field-label">Mother's Contact</span>
            {isEditing ? <input value={formData.motherContact || ''} onChange={e => handleChange('motherContact', e.target.value)} className="portal-input" /> : <span className="sd-field-value">{student.motherContact || '-'}</span>}
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="sd-section">
        <h3 className="sd-section-title">
          <span className="material-symbols-outlined">draw</span>
          Digital Signatures
        </h3>
        <div className="sd-signatures">
          <div className="sd-sig-box">
            {student.shishyaSignature ? <img src={student.shishyaSignature} className="sd-sig-img" alt="Student" /> : <div style={{height: 60}} />}
            <span className="sd-sig-label">SHISHYA</span>
          </div>
          <div className="sd-sig-box">
            {student.parentSignatureAdmission ? <img src={student.parentSignatureAdmission} className="sd-sig-img" alt="Parent" /> : <div style={{height: 60}} />}
            <span className="sd-sig-label">PARENTS / GUARDIAN</span>
          </div>
          <div className="sd-sig-box">
            {student.adminSignatureAdmission ? <img src={student.adminSignatureAdmission} className="sd-sig-img" alt="Admin" /> : <div style={{height: 60}} />}
            <span className="sd-sig-label">ADMINISTRATIVE HEAD</span>
          </div>
        </div>
      </div>
    </div>
  );
}
