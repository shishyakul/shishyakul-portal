import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { createPortal } from 'react-dom';

export default function TabProfile({ student }) {
  const { profile } = useAuth();
  const isServiceManager = profile?.role === 'service_manager' || profile?.role === 'admin';
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ ...student });
  const [saving, setSaving] = useState(false);

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
            <button className="btn-ghost" onClick={() => setIsEditing(true)} style={{ width: '100%', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span> Edit Profile
            </button>
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
