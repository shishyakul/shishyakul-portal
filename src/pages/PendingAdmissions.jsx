import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import SignatureCanvas from 'react-signature-canvas';
import { db } from '../firebase';
import './Admissions.css';

export default function PendingAdmissions() {
  const [pendingStudents, setPendingStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Multi-step Admission Modal State
  const [showAdmitModal, setShowAdmitModal] = useState(false);
  const [pendingAdmitId, setPendingAdmitId] = useState(null);
  const [admitStep, setAdmitStep] = useState(1); // 1 to 4

  const sigCanvasShishyaRef = useRef(null);
  const sigCanvasParentRef = useRef(null);
  const sigCanvasAdminRef = useRef(null);
  const photoInputRef = useRef(null);

  const [admitForm, setAdmitForm] = useState({
    howDidYouKnow: '',
    photoDataUrl: null,

    // Section 1: Bio
    studentName: '',
    dob: '',
    gender: 'Male',
    contactNo: '',
    emailId: '',
    aadharNo: '',
    schoolName: '',
    standard: '10th',
    board: 'CBSE',
    fatherName: '',
    fatherOccupation: '',
    fatherContact: '',
    motherName: '',
    motherOccupation: '',
    motherContact: '',
    isArmedForce: false,
    address: '',
    siblings: [], // array of { name: '', age: '', status: 'Studying' }
    preferredSlot: '04:30 PM - 06:30 PM',

    // Section 2: Psychological Questionnaire
    describeSelf: '',
    passions: '',
    careerGoals: '',
    achievements: '',
    strengths: '',
    improvements: '',
    expectations: '',
    medicalConditions: '',
    emergencyContact: '',
    siblingLink: '',
    guruDakshina: false,

    // Section 3: Financial Schema
    tuitionFees: 0,
    registrationFees: 0,
    libraryFees: 0,
    workoutFees: 0,
    discount: 0,
    installmentsCount: 3,
    installmentsData: [],
    dateOfJoining: new Date().toISOString().split('T')[0],
    dateOfLeaving: '',

    // Section 4: References
    referredStudents: []
  });

  useEffect(() => {
    const q = query(collection(db, 'students'), where('status', '==', 'admitted'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const pending = data.filter(s => !s.admissionDate);
      setPendingStudents(pending);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const openAdmitModal = (student) => {
    setPendingAdmitId(student.id);
    setAdmitStep(1);
    
    setAdmitForm({
      howDidYouKnow: student.reference || '',
      photoDataUrl: null,
      studentName: student.studentName || '',
      dob: student.dob || '',
      gender: student.gender || 'Male',
      contactNo: student.contactNo || student.contactNumber || '',
      emailId: student.emailId || '',
      aadharNo: student.aadharNo || '',
      schoolName: student.schoolName || '',
      standard: student.standard || '10th',
      board: student.board || 'CBSE',
      fatherName: '',
      fatherOccupation: '',
      fatherContact: '',
      motherName: '',
      motherOccupation: '',
      motherContact: '',
      isArmedForce: false,
      address: student.address || '',
      siblings: student.siblings || [],
      preferredSlot: (student.preferredSlots && student.preferredSlots[0]) || student.preferredSlot || '04:30 PM - 06:30 PM',
      emergencyContact: '',
      siblingLink: '',
      
      describeSelf: '', passions: '', careerGoals: '', achievements: '', strengths: '', improvements: '', expectations: '', medicalConditions: '', guruDakshina: false,
      
      tuitionFees: student.phase2Data?.courseFees || 0,
      registrationFees: 500,
      libraryFees: 1000,
      workoutFees: 199,
      discount: student.phase2Data?.discount || 0,
      installmentsCount: student.phase2Data?.installments || 3,
      installmentsData: [],
      dateOfJoining: new Date().toISOString().split('T')[0],
      dateOfLeaving: '',
      
      referredStudents: []
    });
    
    setShowAdmitModal(true);
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Compress image using canvas to avoid Firestore 1MB limit
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setAdmitForm(prev => ({ ...prev, photoDataUrl: compressedDataUrl }));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdmitSubmit = async () => {
    if (!admitForm.guruDakshina) {
      return alert("Guru Dakshina checkbox acknowledgment is required for enrollment!");
    }

    // Handle signature capturing safely
    const getSigData = (ref) => {
      if (!ref.current || ref.current.isEmpty()) return '';
      return ref.current.getCanvas().toDataURL('image/png');
    };

    const shishyaSig = getSigData(sigCanvasShishyaRef);
    const parentSig = getSigData(sigCanvasParentRef);
    const adminSig = getSigData(sigCanvasAdminRef);

    if (!parentSig || !adminSig) {
      return alert("Please ensure both Administrative Head and Parents / Guardian have signed the declaration on Step 3!");
    }

    const totalFees = Number(admitForm.tuitionFees) + 
                      Number(admitForm.registrationFees) + 
                      Number(admitForm.libraryFees) + 
                      Number(admitForm.workoutFees) - 
                      Number(admitForm.discount);

    try {
      await updateDoc(doc(db, 'students', pendingAdmitId), {
        howDidYouKnow: admitForm.howDidYouKnow,
        photoDataUrl: admitForm.photoDataUrl,
        studentName: admitForm.studentName,
        dob: admitForm.dob,
        gender: admitForm.gender,
        contactNo: admitForm.contactNo,
        contactNumber: admitForm.contactNo, 
        emailId: admitForm.emailId,
        aadharNo: admitForm.aadharNo,
        schoolName: admitForm.schoolName,
        standard: admitForm.standard,
        board: admitForm.board,
        fatherName: admitForm.fatherName,
        fatherOccupation: admitForm.fatherOccupation,
        fatherContact: admitForm.fatherContact,
        motherName: admitForm.motherName,
        motherOccupation: admitForm.motherOccupation,
        motherContact: admitForm.motherContact,
        isArmedForce: admitForm.isArmedForce,
        address: admitForm.address,
        siblings: admitForm.siblings,
        preferredSlot: admitForm.preferredSlot,
        emergencyContact: admitForm.emergencyContact,
        siblingLink: admitForm.siblingLink,

        describeSelf: admitForm.describeSelf,
        passions: admitForm.passions,
        careerGoals: admitForm.careerGoals,
        achievements: admitForm.achievements,
        strengths: admitForm.strengths,
        improvements: admitForm.improvements,
        expectations: admitForm.expectations,
        medicalConditions: admitForm.medicalConditions,
        guruDakshina: admitForm.guruDakshina,

        totalFees: totalFees,
        tuitionFees: Number(admitForm.tuitionFees),
        registrationFees: Number(admitForm.registrationFees),
        libraryFees: Number(admitForm.libraryFees),
        workoutFees: Number(admitForm.workoutFees),
        discount: Number(admitForm.discount),
        installments: Number(admitForm.installmentsCount),
        installmentsData: admitForm.installmentsData,
        dateOfJoining: admitForm.dateOfJoining,
        dateOfLeaving: admitForm.dateOfLeaving,
        paidInstallments: [],
        paymentDetails: {},

        referredStudents: admitForm.referredStudents,

        shishyaSignature: shishyaSig,
        parentSignatureAdmission: parentSig,
        adminSignatureAdmission: adminSig,

        admissionDate: new Date().toISOString()
      });

      setShowAdmitModal(false);
      setPendingAdmitId(null);
      setAdmitStep(1);
      alert(`🎉 ${admitForm.studentName}'s admission form has been submitted successfully!`);
    } catch (err) {
      console.error("Error submitting admission form:", err);
      alert("Failed to submit admission form. Error: " + err.message);
    }
  };

  const handleAddSibling = () => setAdmitForm(prev => ({ ...prev, siblings: [...prev.siblings, { name: '', age: '', status: 'Studying' }] }));
  const handleRemoveSibling = (index) => setAdmitForm(prev => ({ ...prev, siblings: prev.siblings.filter((_, i) => i !== index) }));
  const handleSiblingChange = (index, field, value) => {
    setAdmitForm(prev => {
      const copy = [...prev.siblings];
      copy[index][field] = value;
      return { ...prev, siblings: copy };
    });
  };

  const handleAddReference = () => setAdmitForm(prev => ({ ...prev, referredStudents: [...prev.referredStudents, { name: '', batch: '', contact: '' }] }));
  const handleRemoveReference = (index) => setAdmitForm(prev => ({ ...prev, referredStudents: prev.referredStudents.filter((_, i) => i !== index) }));
  const handleReferenceChange = (index, field, value) => {
    setAdmitForm(prev => {
      const copy = [...prev.referredStudents];
      copy[index][field] = value;
      return { ...prev, referredStudents: copy };
    });
  };

  const calcTotalPayable = () => {
    return Number(admitForm.tuitionFees) + 
           Number(admitForm.registrationFees) + 
           Number(admitForm.libraryFees) + 
           Number(admitForm.workoutFees) - 
           Number(admitForm.discount);
  };

  // Auto-generate installments when arriving at Step 4
  useEffect(() => {
    if (admitStep === 4) {
      const total = calcTotalPayable();
      const count = Number(admitForm.installmentsCount) || 1;
      
      // Only generate if we don't have matching data or if the total changed
      const currentSum = admitForm.installmentsData.reduce((sum, row) => sum + Number(row.paid || 0), 0);
      if (admitForm.installmentsData.length !== count || currentSum !== total) {
        const baseInstallment = Math.floor(total / count);
        const remainder = total % count;
        const currentDate = new Date();
        
        const newInstallments = Array.from({ length: count }).map((_, i) => {
          const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
          const monthName = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
          const amount = baseInstallment + (i === 0 ? remainder : 0); // Add remainder to the first installment
          return { month: monthName, paid: amount, mode: 'Cash', details: '' };
        });
        
        setAdmitForm(prev => ({ ...prev, installmentsData: newInstallments }));
      }
    }
  }, [admitStep, admitForm.tuitionFees, admitForm.discount, admitForm.registrationFees, admitForm.libraryFees, admitForm.workoutFees, admitForm.installmentsCount]);

  const handleInstallmentChange = (index, field, value) => {
    setAdmitForm(prev => {
      const copy = [...prev.installmentsData];
      copy[index][field] = value;
      return { ...prev, installmentsData: copy };
    });
  };

  return (
    <div>
      <div className="page-header" style={{ paddingBottom: 16 }}>
        <div>
          <h1 className="page-title">Pending Admissions</h1>
          <p className="page-subtitle">Students verified by Admin, pending the final 4-step admission form completion by parents.</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : pendingStudents.length === 0 ? (
        <div style={{ background: 'var(--surface-bg)', padding: '48px', borderRadius: '12px', border: '1px solid var(--surface-border)', textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--brand-primary)', opacity: 0.5, marginBottom: '16px' }}>check_circle</span>
          <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '8px' }}>All Caught Up!</h3>
          <p style={{ color: 'var(--text-secondary)' }}>No students are currently pending admission form completion.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {pendingStudents.map(student => (
            <div 
              key={student.id} 
              style={{ background: 'var(--surface-bg)', borderRadius: '12px', border: '1px solid var(--surface-border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onClick={() => openAdmitModal(student)}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{student.studentName}</h3>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{student.standard} - {student.board}</div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact</div>
                  <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{student.contactNo}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>School</div>
                  <div style={{ fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.schoolName}</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '16px', display: 'flex', justifyContent: 'center' }}>
                <button className="btn btn-brand" style={{ width: '100%' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '18px', marginRight: '8px' }}>assignment</span>
                  Fill Admission Form
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🎉 Multi-Step PDF Admission Form Modal */}
      {showAdmitModal && (
        <div className="admission-modal-overlay">
          <div className="admission-modal multistep">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="modal-title" style={{ marginBottom: 0, textTransform: 'uppercase', textDecoration: 'underline' }}>ADMISSION FORM</h2>
              <span className="step-indicator">Page {admitStep} of 4</span>
            </div>

            <div className="step-tracker">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className={`step-circle ${admitStep === s ? 'active' : ''} ${admitStep > s ? 'completed' : ''}`}>{s}</div>
              ))}
            </div>

            <div className="multistep-form-content">
              {/* STEP 1: SHISHYA'S BIO */}
              <div className="form-step-pane" style={{ display: admitStep === 1 ? 'block' : 'none' }}>
                <div className="modal-form-group" style={{ marginBottom: '24px' }}>
                    <label className="form-label">HOW DID YOU COME TO KNOW ABOUT US?</label>
                    <input type="text" value={admitForm.howDidYouKnow} onChange={e => setAdmitForm({ ...admitForm, howDidYouKnow: e.target.value })} className="portal-input" />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <h3 className="section-title" style={{ margin: 0 }}>SHISHYA'S BIO:</h3>
                    {/* Live Photo Capture Box */}
                    <div style={{ width: '120px', height: '140px', border: '2px dashed var(--surface-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-bg)', position: 'relative', overflow: 'hidden' }}>
                      {admitForm.photoDataUrl ? (
                        <img src={admitForm.photoDataUrl} alt="Shishya" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <>
                          <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--text-muted)' }}>add_a_photo</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>Capture<br/>Photo</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="user" 
                        ref={photoInputRef}
                        onChange={handlePhotoCapture}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                    <div className="modal-form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">SHISHYA'S NAME:</label>
                      <input type="text" value={admitForm.studentName} onChange={e => setAdmitForm({ ...admitForm, studentName: e.target.value })} className="portal-input" required />
                    </div>
                    <div className="modal-form-group">
                      <label className="form-label">DATE OF BIRTH:</label>
                      <input type="date" value={admitForm.dob} onChange={e => setAdmitForm({ ...admitForm, dob: e.target.value })} className="portal-input" />
                    </div>

                    <div className="modal-form-group">
                      <label className="form-label">GENDER:</label>
                      <select value={admitForm.gender} onChange={e => setAdmitForm({ ...admitForm, gender: e.target.value })} className="portal-select">
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="modal-form-group">
                      <label className="form-label">PERSONAL CONTACT NO:</label>
                      <input type="tel" value={admitForm.contactNo} onChange={e => setAdmitForm({ ...admitForm, contactNo: e.target.value })} className="portal-input" required />
                    </div>
                    <div className="modal-form-group">
                      <label className="form-label">EMAIL ID:</label>
                      <input type="email" value={admitForm.emailId} onChange={e => setAdmitForm({ ...admitForm, emailId: e.target.value })} className="portal-input" />
                    </div>

                    <div className="modal-form-group">
                      <label className="form-label">AADHAR CARD:</label>
                      <input type="text" value={admitForm.aadharNo} onChange={e => setAdmitForm({ ...admitForm, aadharNo: e.target.value })} className="portal-input" />
                    </div>
                    <div className="modal-form-group">
                      <label className="form-label">SCHOOL NAME:</label>
                      <input type="text" value={admitForm.schoolName} onChange={e => setAdmitForm({ ...admitForm, schoolName: e.target.value })} className="portal-input" />
                    </div>
                    <div className="modal-form-group">
                      <label className="form-label">CLASS (BOARD):</label>
                      <input type="text" value={admitForm.standard} onChange={e => setAdmitForm({ ...admitForm, standard: e.target.value })} className="portal-input" />
                    </div>

                    <div className="modal-form-group">
                      <label className="form-label">FATHER'S NAME:</label>
                      <input type="text" value={admitForm.fatherName} onChange={e => setAdmitForm({ ...admitForm, fatherName: e.target.value })} className="portal-input" />
                    </div>
                    <div className="modal-form-group">
                      <label className="form-label">FATHER'S CONTACT NO:</label>
                      <input type="tel" value={admitForm.fatherContact} onChange={e => setAdmitForm({ ...admitForm, fatherContact: e.target.value })} className="portal-input" />
                    </div>
                    <div className="modal-form-group">
                      <label className="form-label">FATHER'S OCCUPATION:</label>
                      <input type="text" value={admitForm.fatherOccupation} onChange={e => setAdmitForm({ ...admitForm, fatherOccupation: e.target.value })} className="portal-input" />
                    </div>

                    <div className="modal-form-group">
                      <label className="form-label">MOTHER'S NAME:</label>
                      <input type="text" value={admitForm.motherName} onChange={e => setAdmitForm({ ...admitForm, motherName: e.target.value })} className="portal-input" />
                    </div>
                    <div className="modal-form-group">
                      <label className="form-label">MOTHER'S CONTACT NO:</label>
                      <input type="tel" value={admitForm.motherContact} onChange={e => setAdmitForm({ ...admitForm, motherContact: e.target.value })} className="portal-input" />
                    </div>
                    <div className="modal-form-group">
                      <label className="form-label">MOTHER'S OCCUPATION:</label>
                      <input type="text" value={admitForm.motherOccupation} onChange={e => setAdmitForm({ ...admitForm, motherOccupation: e.target.value })} className="portal-input" />
                    </div>

                    <div className="modal-form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label" style={{ color: 'var(--status-error)' }}>EMERGENCY CONTACT (NAME & NUMBER)</label>
                      <input type="text" placeholder="e.g. Uncle Ramesh: 9876543210" value={admitForm.emergencyContact} onChange={e => setAdmitForm({ ...admitForm, emergencyContact: e.target.value })} className="portal-input" />
                    </div>
                    <div className="modal-form-group">
                      <label className="form-label">SIBLING LINK (IN SHISHYAKUL)</label>
                      <input type="text" placeholder="e.g. Priya Sharma (8th)" value={admitForm.siblingLink} onChange={e => setAdmitForm({ ...admitForm, siblingLink: e.target.value })} className="portal-input" />
                    </div>

                    <div className="modal-form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', gridColumn: 'span 3' }}>
                      <input type="checkbox" id="isArmedForce" checked={admitForm.isArmedForce} onChange={e => setAdmitForm({ ...admitForm, isArmedForce: e.target.checked })} />
                      <label htmlFor="isArmedForce" className="form-label" style={{ cursor: 'pointer', margin: 0 }}>ARMED / POLICE FORCE</label>
                    </div>
                    <div className="modal-form-group" style={{ gridColumn: 'span 3' }}>
                      <label className="form-label">RESIDENTIAL ADDRESS:</label>
                      <textarea rows={2} value={admitForm.address} onChange={e => setAdmitForm({ ...admitForm, address: e.target.value })} className="portal-input" />
                    </div>
                  </div>

                  <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 className="section-title" style={{ margin: 0 }}>SIBLING INFO:</h3>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddSibling}>+ Add Sibling</button>
                    </div>
                    <table className="dynamic-table">
                      <thead>
                        <tr>
                          <th>SR. NO.</th>
                          <th>NAME</th>
                          <th>AGE</th>
                          <th>STUDYING / WORKING</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {admitForm.siblings.map((sib, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td><input type="text" value={sib.name} onChange={e => handleSiblingChange(index, 'name', e.target.value)} className="portal-input table-input" /></td>
                            <td><input type="number" value={sib.age} onChange={e => handleSiblingChange(index, 'age', e.target.value)} className="portal-input table-input" style={{ width: '60px' }} /></td>
                            <td>
                              <select value={sib.status} onChange={e => handleSiblingChange(index, 'status', e.target.value)} className="portal-select table-input">
                                <option value="Studying">Studying</option>
                                <option value="Working">Working</option>
                                <option value="Other">Other</option>
                              </select>
                            </td>
                            <td><button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveSibling(index)}>Remove</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="modal-form-group" style={{ marginTop: '24px' }}>
                    <h3 className="section-title">TIME SLOTS:</h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
                      SELECT ANY 2 TIMES SLOTS. ALLOCATED TIME SLOTS WILL BE ON FIRST COME FIRST SERVE BASIS & WILL BE APPLICABLE TILL JUNE ONLY. FINAL SLOTS WILL BE ALLOTTED BY OUR TEACHER & SERVICE MANAGEMENT TEAM ON THE BASIS OF SHISHYA’S PERFORMANCE & NOT ON PERSONAL PREFERENCES. A STEP TAKEN TO MAXIMIZE SHISHYA’S ACADEMIC PERFORMANCE.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {['02:00 PM - 04:00 PM', '04:30 PM - 06:30 PM', '07:00 PM - 09:00 PM'].map(slot => (
                        <label key={slot} className="checkbox-item" style={{ fontSize: '13px', fontWeight: 600 }}>
                          <input type="radio" name="preferredSlot" checked={admitForm.preferredSlot === slot} onChange={() => setAdmitForm({ ...admitForm, preferredSlot: slot })} />
                          {slot}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

              {/* STEP 2: SHISHYA'S SECTION */}
              <div className="form-step-pane" style={{ display: admitStep === 2 ? 'block' : 'none' }}>
                <h3 className="section-title">SHISHYA'S SECTION</h3>
                  
                  <div className="modal-form-group">
                    <label className="form-label">1. DESCRIBE YOURSELF:</label>
                    <textarea rows={2} value={admitForm.describeSelf} onChange={e => setAdmitForm({ ...admitForm, describeSelf: e.target.value })} className="portal-input" />
                  </div>
                  <div className="modal-form-group">
                    <label className="form-label">2. PASSION / SKILLS / HOBBIES:</label>
                    <textarea rows={2} value={admitForm.passions} onChange={e => setAdmitForm({ ...admitForm, passions: e.target.value })} className="portal-input" />
                  </div>
                  <div className="modal-form-group">
                    <label className="form-label">3. DREAMS / CAREER GOALS:</label>
                    <textarea rows={2} value={admitForm.careerGoals} onChange={e => setAdmitForm({ ...admitForm, careerGoals: e.target.value })} className="portal-input" />
                  </div>
                  <div className="modal-form-group">
                    <label className="form-label">4. ACHIEVEMENTS & FALIURE:</label>
                    <textarea rows={2} value={admitForm.achievements} onChange={e => setAdmitForm({ ...admitForm, achievements: e.target.value })} className="portal-input" />
                  </div>
                  <div className="modal-form-group">
                    <label className="form-label">5. STRENGTH & WEAKNESS:</label>
                    <textarea rows={2} value={admitForm.strengths} onChange={e => setAdmitForm({ ...admitForm, strengths: e.target.value })} className="portal-input" />
                  </div>
                  <div className="modal-form-group">
                    <label className="form-label">6. THINGS THAT YOU WANT TO IMPROVE:</label>
                    <textarea rows={2} value={admitForm.improvements} onChange={e => setAdmitForm({ ...admitForm, improvements: e.target.value })} className="portal-input" />
                  </div>
                  <div className="modal-form-group">
                    <label className="form-label">7. EXPECTATIONS FROM SHISHYAKUL:</label>
                    <textarea rows={2} value={admitForm.expectations} onChange={e => setAdmitForm({ ...admitForm, expectations: e.target.value })} className="portal-input" />
                  </div>
                  <div className="modal-form-group">
                    <label className="form-label">8. MEDICAL CONDITIONS OR ALLERGIES</label>
                    <input type="text" value={admitForm.medicalConditions} onChange={e => setAdmitForm({ ...admitForm, medicalConditions: e.target.value })} className="portal-input" />
                  </div>

                  <h3 className="section-title" style={{ marginTop: '32px' }}>GURU DAKSHINA (OPTIONAL):</h3>
                  <div style={{ background: 'var(--surface-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5, fontWeight: 500 }}>
                      SHISHYAKUL HAS A TRADITIONAL WAY OF EXPRESSING A SYMBOLIC GESTURE OF GRATITUDE, RESPECT & APPRECIATION TOWARDS OUR GURUS. ‘GURU DAKSHINA’ IS A WAY FOR THE STUDENT TO ACKNOWLEDGE & APPRECIATE THE INVALUABLE KNOWLEDGE IMPARTED BY GURUS.
                    </p>
                    <div className="modal-form-group" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: '12px', marginBottom: '24px' }}>
                      <input type="checkbox" id="guruDakshina" checked={admitForm.guruDakshina} onChange={e => setAdmitForm({ ...admitForm, guruDakshina: e.target.checked })} style={{ marginTop: '4px' }} />
                      <label htmlFor="guruDakshina" className="form-label" style={{ cursor: 'pointer', margin: 0, fontWeight: '700', fontSize: '13px' }}>
                        I THE UNDERSIGNED STATE THAT I WILL GIVE MY 100% TO MY GURU & SHISHYAKUL.<br/>
                        I PROMISE YOU THAT I WILL PAY MY GURU DAKSHINA WHENEVER I AM ASKED TOO.
                      </label>
                    </div>

                    <div style={{ width: '300px' }}>
                      <label className="form-label">SHISHYA'S SIGN</label>
                      <div style={{ border: '2px dashed var(--surface-border)', borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
                        <SignatureCanvas ref={sigCanvasShishyaRef} penColor="black" canvasProps={{ width: 300, height: 120, style: { width: '100%', height: '120px', cursor: 'crosshair' } }} />
                      </div>
                      <button className="btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => sigCanvasShishyaRef.current?.clear()}>Clear</button>
                    </div>
                  </div>
                </div>

              {/* STEP 3: FEES SUMMARY & DECLARE */}
              <div className="form-step-pane" style={{ display: admitStep === 3 ? 'block' : 'none' }}>
                <h3 className="section-title">FEES SUMMARY</h3>
                  <div style={{ display: 'flex', gap: '48px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>NAME: <span style={{ fontWeight: 400 }}>{admitForm.studentName}</span></div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>CLASS (BOARD): <span style={{ fontWeight: 400 }}>{admitForm.standard}</span></div>
                  </div>
                  
                <div className="table-responsive">
                  <table className="portal-table" style={{ width: '100%', marginBottom: '32px' }}>
                    <thead style={{ background: 'var(--surface-bg)' }}>
                      <tr>
                        <th style={{ padding: '8px' }}>SR. NO.</th>
                        <th style={{ padding: '8px' }}>DESCRIPTION</th>
                        <th style={{ padding: '8px' }}>AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px' }}>1.</td>
                        <td style={{ padding: '8px', fontWeight: 600 }}>TUTION FEES</td>
                        <td style={{ padding: '8px' }}>₹{admitForm.tuitionFees}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px' }}>2.</td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ fontWeight: 600 }}>REGISTRATION FEES</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>(NON-REFUNDABLE / ONE-TIME FEE)</div>
                        </td>
                        <td style={{ padding: '8px' }}>₹{admitForm.registrationFees}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px' }}>3.</td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ fontWeight: 600 }}>LIBRARY / BOOK FEES</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>(REFUNDABLE)</div>
                        </td>
                        <td style={{ padding: '8px' }}>₹{admitForm.libraryFees}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px' }}>4.</td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ fontWeight: 600 }}>WORKOUT</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>(RS. 199/- PER MONTH)</div>
                        </td>
                        <td style={{ padding: '8px' }}>₹{admitForm.workoutFees}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px' }}>5.</td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ fontWeight: 600 }}>DISCOUNT</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>(TUTION FEES)</div>
                        </td>
                        <td style={{ padding: '8px' }}>₹{admitForm.discount}</td>
                      </tr>
                      <tr style={{ background: 'rgba(34, 197, 94, 0.1)', borderTop: '2px solid var(--brand-primary)' }}>
                        <td style={{ padding: '12px 8px' }}>6.</td>
                        <td style={{ padding: '12px 8px', fontWeight: 700 }}>TOTAL PAYABLE AMOUNT</td>
                        <td style={{ padding: '12px 8px', fontWeight: 700, fontSize: '16px' }}>₹{calcTotalPayable().toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                  <h3 className="section-title">DECLARE:</h3>
                  <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: '24px' }}>
                    <ol style={{ margin: 0, paddingLeft: '20px', fontWeight: 600 }}>
                      <li>I UNDERSTAND THAT ADMISSION IS STRICTLY CONDITIONAL UPON THE FULL & TIMELY PAYMENT OF THE FEES.</li>
                      <li>NON-PAYMENT WILL RESULT IN SUSPENSION & CANCELLATION OF ADMISSION OR ANY LEGAL ACTION.</li>
                      <li>THE STUDENT AGREES TO FOLLOW ALL RULES, RESPECT ALL GURUS & STAFF & MAINTAIN PROPER DISCIPLINE AT ALL TIMES.</li>
                      <li>I ACKNOWLEDGE THAT SHISHYAKUL IS NOT RESPONSIBLE FOR ANY LOSS OR THEFT OF ANY PERSONAL OR VALUABLE ITEMS SUCH AS MOBILES, WATCHES, BICYCLES ETC.</li>
                      <li>I CONFIRM THAT ALL THE INFORMATION PROVIDED IS TRUE AND CORRECT TO THE BEST OF MY KNOWLEDGE.</li>
                      <li>I FULLY ACCEPT THE ABOVE DECLARATION AND AGREE TO COMPLY WITHOUT EXCEPTION.</li>
                    </ol>
                  </div>

                  <div style={{ display: 'flex', gap: '32px', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ textAlign: 'center' }}>ADMINISTRATIVE HEAD</label>
                      <div style={{ border: '2px dashed var(--surface-border)', borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
                        <SignatureCanvas ref={sigCanvasAdminRef} penColor="black" canvasProps={{ width: 300, height: 120, style: { width: '100%', height: '120px', cursor: 'crosshair' } }} />
                      </div>
                      <button className="btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => sigCanvasAdminRef.current?.clear()}>Clear</button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ textAlign: 'center' }}>PARENTS / GUARDIAN</label>
                      <div style={{ border: '2px dashed var(--surface-border)', borderRadius: '8px', background: '#fff', overflow: 'hidden' }}>
                        <SignatureCanvas ref={sigCanvasParentRef} penColor="black" canvasProps={{ width: 300, height: 120, style: { width: '100%', height: '120px', cursor: 'crosshair' } }} />
                      </div>
                      <button className="btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => sigCanvasParentRef.current?.clear()}>Clear</button>
                    </div>
                  </div>
                </div>

              {/* STEP 4: INSTALLMENT DETAILS & REFERENCES */}
              <div className="form-step-pane" style={{ display: admitStep === 4 ? 'block' : 'none' }}>
                <h3 className="section-title">INSTALLMENT DETAILS</h3>
                  <div style={{ display: 'flex', gap: '48px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>TOTAL FEES: <span style={{ fontWeight: 400 }}>₹{calcTotalPayable().toLocaleString()}</span></div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>
                      TOTAL NO. OF INSTALLMENTS: 
                      <input 
                        type="number" 
                        min="1" 
                        max="12" 
                        value={admitForm.installmentsCount} 
                        onChange={e => setAdmitForm({...admitForm, installmentsCount: e.target.value})} 
                        className="portal-input" 
                        style={{ display: 'inline-block', width: '60px', marginLeft: '8px', padding: '4px 8px', height: '28px' }} 
                      />
                    </div>
                  </div>

                <div className="table-responsive">
                  <table className="portal-table" style={{ width: '100%', marginBottom: '32px' }}>
                    <thead style={{ background: 'var(--surface-bg)' }}>
                      <tr>
                        <th style={{ padding: '8px' }}>SR.</th>
                        <th style={{ padding: '8px' }}>MONTH</th>
                        <th style={{ padding: '8px' }}>PAID (₹)</th>
                        <th style={{ padding: '8px' }}>MODE</th>
                        <th style={{ padding: '8px' }}>BALANCE (₹)</th>
                        <th style={{ padding: '8px' }}>DETAILS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admitForm.installmentsData.map((row, idx) => {
                        // Calculate running balance: Total - sum of paid up to this row
                        const sumPaidUpToHere = admitForm.installmentsData.slice(0, idx + 1).reduce((acc, curr) => acc + Number(curr.paid || 0), 0);
                        const balance = calcTotalPayable() - sumPaidUpToHere;
                        
                        return (
                          <tr key={idx}>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--surface-border)', textAlign: 'center' }}>{idx + 1}</td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--surface-border)' }}>
                              <input type="text" value={row.month} onChange={e => handleInstallmentChange(idx, 'month', e.target.value)} className="portal-input table-input" />
                            </td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--surface-border)' }}>
                              <input type="number" value={row.paid} onChange={e => handleInstallmentChange(idx, 'paid', e.target.value)} className="portal-input table-input" />
                            </td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--surface-border)' }}>
                              <input type="text" value={row.mode} onChange={e => handleInstallmentChange(idx, 'mode', e.target.value)} className="portal-input table-input" />
                            </td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--surface-border)', fontWeight: 600, color: balance > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>
                              ₹{balance.toLocaleString()}
                            </td>
                            <td style={{ padding: '8px', borderBottom: '1px solid var(--surface-border)' }}>
                              <input type="text" value={row.details} onChange={e => handleInstallmentChange(idx, 'details', e.target.value)} className="portal-input table-input" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 className="section-title" style={{ margin: 0 }}>REFERENCES</h3>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddReference}>+ Add Reference</button>
                  </div>
                  <table className="dynamic-table" style={{ marginBottom: '8px' }}>
                    <thead>
                      <tr>
                        <th>SR. NO.</th>
                        <th>NAME OF STUDENT</th>
                        <th>CLASS (BATCH)</th>
                        <th>CONTACT NO.</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admitForm.referredStudents.map((ref, index) => (
                        <tr key={index}>
                          <td>{index + 1}</td>
                          <td><input type="text" value={ref.name} onChange={e => handleReferenceChange(index, 'name', e.target.value)} className="portal-input table-input" /></td>
                          <td><input type="text" value={ref.batch} onChange={e => handleReferenceChange(index, 'batch', e.target.value)} className="portal-input table-input" /></td>
                          <td><input type="tel" value={ref.contact} onChange={e => handleReferenceChange(index, 'contact', e.target.value)} className="portal-input table-input" /></td>
                          <td><button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveReference(index)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '32px', textAlign: 'center' }}>
                    (NOTE: REFERENCE AMOUNT WILL BE CLEARED WHEN THE REFFERED PERSON CLEARS THE FIRST INSTALLMENT.)
                  </div>

                  <h3 className="section-title">ADDITIONAL INFORMATION:</h3>
                  <div className="form-grid-modal" style={{ marginBottom: '32px' }}>
                    <div className="modal-form-group">
                      <label className="form-label">DATE OF JOINING:</label>
                      <input type="date" value={admitForm.dateOfJoining} onChange={e => setAdmitForm({ ...admitForm, dateOfJoining: e.target.value })} className="portal-input" />
                    </div>
                    <div className="modal-form-group">
                      <label className="form-label">DATE OF LEAVING:</label>
                      <input type="date" value={admitForm.dateOfLeaving} onChange={e => setAdmitForm({ ...admitForm, dateOfLeaving: e.target.value })} className="portal-input" />
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', fontWeight: 700, color: 'var(--brand-primary)', fontSize: '16px', letterSpacing: '1px' }}>
                    || जय हिन्द जय भारत ||
                  </div>
                </div>
              </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setShowAdmitModal(false); setPendingAdmitId(null); setAdmitStep(1); }}>Cancel</button>
              {admitStep > 1 && <button className="btn btn-ghost" onClick={() => setAdmitStep(admitStep - 1)}>Back</button>}
              {admitStep < 4 ? (
                <button className="btn btn-brand" onClick={() => setAdmitStep(admitStep + 1)}>Next</button>
              ) : (
                <button className="btn btn-brand" onClick={handleAdmitSubmit}>Submit Admission Form</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
