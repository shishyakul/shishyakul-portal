import React, { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import SignatureCanvas from 'react-signature-canvas';
import { db } from '../firebase';
import './EnquiryKiosk.css';

export default function EnquiryKiosk() {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [formData, setFormData] = useState({
    enquiryDate: new Date().toISOString().split('T')[0],
    reference: 'banner',
    referringStudentName: '',
    assignedCouncillor: '',
    enquiryType: 'new_admission', // or 'in_house'
    
    // Bio
    studentName: '',
    contactNo: '',
    emailId: '',
    address: '',
    
    // Academic
    schoolName: '',
    dispersalTime: '',
    standard: '10th',
    board: 'CBSE',
    prevClassPercent: '',
    prevTuition: '',
    reasonForLeaving: '',
    
    // Parent
    parentName: '',
    parentContact: '',
    parentEmail: '',
    
    // Subject Selection
    languages: [], // English, Hindi, Marathi, Sanskrit
    coreMaths: 'standard', // standard or basic
    coreScience: false,
    coreSocial: false,
    technologies: [], // IT, AI, DS, CA
    
    // Time Slots
    preferredSlots: [], // max 2
    
    // Signature
    parentSignature: ''
  });

  const sigCanvasRef = useRef(null);

  const handleCheckboxArray = (e, arrayName, limit = null) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      let updatedArr = [...prev[arrayName]];
      if (checked) {
        if (limit && updatedArr.length >= limit) return prev; // Do not allow exceeding limit
        updatedArr.push(value);
      } else {
        updatedArr = updatedArr.filter(item => item !== value);
      }
      return { ...prev, [arrayName]: updatedArr };
    });
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const signatureDataUrl = sigCanvasRef.current?.isEmpty() ? '' : sigCanvasRef.current.getCanvas().toDataURL('image/png');

      await addDoc(collection(db, 'students'), {
        ...formData,
        parentSignature: signatureDataUrl,
        status: 'enquiry', // Pushes to the Kanban "Enquiry" column
        createdAt: serverTimestamp()
      });
      
      setSuccessMsg(`✅ ${formData.studentName}'s enquiry has been successfully registered!`);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccessMsg(''), 5000);
      
      // Reset form
      setFormData(prev => ({
        ...prev,
        reference: 'banner',
        referringStudentName: '',
        studentName: '',
        contactNo: '',
        emailId: '',
        address: '',
        schoolName: '',
        prevClassPercent: '',
        prevTuition: '',
        reasonForLeaving: '',
        parentName: '',
        parentContact: '',
        parentEmail: '',
        languages: [],
        technologies: [],
        preferredSlots: [],
        parentSignature: ''
      }));
      if (sigCanvasRef.current) sigCanvasRef.current.clear();
    } catch (error) {
      console.error('Error adding document: ', error);
      alert('Failed to register enquiry. See console for details.');
    }
    
    setLoading(false);
  };

  return (
    <div className="enquiry-container">
      <div className="enquiry-header">
        <h1>Digital Enquiry Kiosk</h1>
        <p>Register walk-in students and auto-push them to the Admission Kanban Pipeline.</p>
      </div>

      {successMsg && (
        <div className="success-banner">
          {successMsg}
        </div>
      )}

      <form className="enquiry-form" onSubmit={handleSubmit}>
        
        {/* Office Details */}
        <div className="form-section">
          <h2 className="form-section-title">Office Use</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Enquiry Date</label>
              <input type="date" name="enquiryDate" value={formData.enquiryDate} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Reference (Source)</label>
              <select name="reference" value={formData.reference} onChange={handleChange}>
                <option value="banner">Banner / Hoarding</option>
                <option value="pamphlet">Pamphlet</option>
                <option value="calling">Calling Campaign</option>
                <option value="parents">Parents to Parents</option>
                <option value="in_house">In-House</option>
                <option value="sk_student">SK Student</option>
              </select>
            </div>
            {formData.reference === 'sk_student' && (
              <div className="form-group">
                <label>Referring Student's Name</label>
                <input type="text" name="referringStudentName" placeholder="Senior student name" value={formData.referringStudentName} onChange={handleChange} required />
              </div>
            )}
            <div className="form-group">
              <label>Assigned Councillor</label>
              <input type="text" name="assignedCouncillor" value={formData.assignedCouncillor} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Enquiry Type</label>
              <select name="enquiryType" value={formData.enquiryType} onChange={handleChange}>
                <option value="new_admission">New Admission</option>
                <option value="in_house">In-House (Renewal)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Student Details */}
        <div className="form-section">
          <h2 className="form-section-title">Shishya's Information</h2>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Full Name</label>
              <input type="text" name="studentName" value={formData.studentName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Contact Number</label>
              <input type="tel" name="contactNo" value={formData.contactNo} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" name="emailId" value={formData.emailId} onChange={handleChange} />
            </div>
            <div className="form-group full-width">
              <label>Residential Address</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} required />
            </div>
          </div>
        </div>

        {/* Academic Profile */}
        <div className="form-section">
          <h2 className="form-section-title">Academic Profile</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>School Name</label>
              <input type="text" name="schoolName" value={formData.schoolName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>School Dispersal Time</label>
              <input type="time" name="dispersalTime" value={formData.dispersalTime} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Standard</label>
              <select name="standard" value={formData.standard} onChange={handleChange}>
                <option value="8th">8th STD</option>
                <option value="9th">9th STD</option>
                <option value="10th">10th STD</option>
              </select>
            </div>
            <div className="form-group">
              <label>Board</label>
              <select name="board" value={formData.board} onChange={handleChange}>
                <option value="CBSE">CBSE</option>
                <option value="State">State Board</option>
                <option value="ICSE">ICSE</option>
              </select>
            </div>
            <div className="form-group">
              <label>Previous Class %</label>
              <input type="text" name="prevClassPercent" placeholder="e.g. 85%" value={formData.prevClassPercent} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Previous Tuition</label>
              <input type="text" name="prevTuition" value={formData.prevTuition} onChange={handleChange} />
            </div>
            <div className="form-group full-width">
              <label>Reason for Leaving Previous Tuition</label>
              <input type="text" name="reasonForLeaving" value={formData.reasonForLeaving} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Parent Details */}
        <div className="form-section">
          <h2 className="form-section-title">Parent/Guardian Information</h2>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Parent Name</label>
              <input type="text" name="parentName" value={formData.parentName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Parent Contact Number</label>
              <input type="tel" name="parentContact" value={formData.parentContact} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Parent Email ID</label>
              <input type="email" name="parentEmail" value={formData.parentEmail} onChange={handleChange} />
            </div>
          </div>
        </div>

        {/* Subject Selection */}
        <div className="form-section">
          <h2 className="form-section-title">Subject Selection & Preferences</h2>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Language Option</label>
              <div className="checkbox-group">
                {['English', 'Hindi', 'Marathi', 'Sanskrit'].map(lang => (
                  <label key={lang} className="checkbox-item">
                    <input 
                      type="checkbox" 
                      value={lang} 
                      checked={formData.languages.includes(lang)}
                      onChange={e => handleCheckboxArray(e, 'languages')}
                    />
                    {lang}
                  </label>
                ))}
              </div>
            </div>
            
            <div className="form-group full-width">
              <label>Core Subjects</label>
              <div className="checkbox-group">
                <label className="checkbox-item" style={{ marginRight: '16px' }}>
                  <strong>Maths:</strong>
                  <select 
                    name="coreMaths" 
                    value={formData.coreMaths} 
                    onChange={handleChange}
                    style={{ marginLeft: '8px', padding: '4px', borderRadius: '4px', border: '1px solid var(--surface-border)' }}
                  >
                    <option value="standard">Standard</option>
                    <option value="basic">Basic</option>
                  </select>
                </label>
                <label className="checkbox-item">
                  <input type="checkbox" name="coreScience" checked={formData.coreScience} onChange={handleChange} />
                  Science
                </label>
                <label className="checkbox-item">
                  <input type="checkbox" name="coreSocial" checked={formData.coreSocial} onChange={handleChange} />
                  Social Science
                </label>
              </div>
            </div>

            <div className="form-group full-width">
              <label>Technology Subject</label>
              <div className="checkbox-group">
                {['IT', 'AI', 'DS', 'CA'].map(tech => (
                  <label key={tech} className="checkbox-item">
                    <input 
                      type="checkbox" 
                      value={tech} 
                      checked={formData.technologies.includes(tech)}
                      onChange={e => handleCheckboxArray(e, 'technologies')}
                    />
                    {tech}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group full-width">
              <label>Time Slot Preference</label>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: '1.4' }}>
                SELECT ANY 2 TIME SLOTS. ALLOCATED TIME SLOTS WILL BE ON FIRST COME FIRST SERVE BASIS & WILL BE APPLICABLE TILL JUNE ONLY. 
                FINAL SLOTS WILL BE ALLOTTED BY OUR TEACHER & SERVICE MANAGEMENT TEAM ON THE BASIS OF SHISHYA'S PERFORMANCE & NOT ON PERSONAL PREFERENCES. 
                A STEP TAKEN TO MAXIMIZE SHISHYA'S ACADEMIC PERFORMANCE.
              </p>
              <div className="checkbox-group">
                {['02:00 PM - 04:00 PM', '04:30 PM - 06:30 PM', '07:00 PM - 09:00 PM'].map(slot => (
                  <label key={slot} className="checkbox-item">
                    <input 
                      type="checkbox" 
                      value={slot} 
                      checked={formData.preferredSlots.includes(slot)}
                      onChange={e => handleCheckboxArray(e, 'preferredSlots', 2)}
                      disabled={!formData.preferredSlots.includes(slot) && formData.preferredSlots.length >= 2}
                    />
                    {slot}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="form-section">
          <h2 className="form-section-title">Parent Signature</h2>
          <div className="form-grid" style={{ display: 'block' }}>
            <div style={{ border: '2px dashed var(--surface-border)', borderRadius: '8px', background: 'var(--surface-bg)', marginBottom: '12px', overflow: 'hidden' }}>
              <SignatureCanvas 
                ref={sigCanvasRef} 
                penColor="black" 
                backgroundColor="white"
                canvasProps={{ width: 600, height: 200, className: 'sigCanvas', style: { width: '100%', height: '200px', cursor: 'crosshair', border: '1px solid #ccc', borderRadius: '4px' } }} 
              />
            </div>
            <div style={{ textAlign: 'right' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => sigCanvasRef.current?.clear()}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>ink_eraser</span> Clear Signature
              </button>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => window.location.reload()}>Reset Form</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            <span className="material-symbols-outlined">send</span>
            {loading ? 'Registering...' : 'Register Enquiry'}
          </button>
        </div>

      </form>
    </div>
  );
}
