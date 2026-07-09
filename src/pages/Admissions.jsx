import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, arrayUnion, limit } from 'firebase/firestore';
import SignatureCanvas from 'react-signature-canvas';
import { db } from '../firebase';
import './Admissions.css';

const COLUMNS = [
  { id: 'enquiry', title: '1. Walk-in Enquiry' },
  { id: 'demo', title: '2. Taking Demo' },
  { id: 'admitted', title: '3. Admitted / Paid' },
  { id: 'dropped', title: 'Dropped / Rejected' }
];

const BATCH_DEF = {
  '8th': ['8th-CBSE Alpha', '8th-CBSE Bravo', '8th-CBSE Delta', '8th-CBSE Echo'],
  '9th': ['9th-CBSE Alpha', '9th-CBSE Bravo', '9th-CBSE Charlie', '9th-CBSE Echo', '9th-CBSE Foxtrot', '9th-State Delta'],
  '10th': ['10th-CBSE Alpha', '10th-CBSE Bravo', '10th-CBSE Charlie', '10th-CBSE Delta', '10th-CBSE Echo', '10th-CBSE Foxtrot', '10th-State Hitman', '10th-State Golf']
};

/* --- Component Start --- */

export default function Admissions() {
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState('enquiry');
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // Call Notes Modal State
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [activeNotesStudent, setActiveNotesStudent] = useState(null);
  const [newCallLogText, setNewCallLogText] = useState('');

  // Drop Modal State
  const [showDropModal, setShowDropModal] = useState(false);
  const [pendingDropId, setPendingDropId] = useState(null);
  const [dropReason, setDropReason] = useState('');
  const [customDropReason, setCustomDropReason] = useState('');

  // Phase 2 Enquiry Modal State
  const [showPhase2Modal, setShowPhase2Modal] = useState(false);
  const [activePhase2Student, setActivePhase2Student] = useState(null);
  const [phase2Form, setPhase2Form] = useState({
    courseFees: '',
    discount: '',
    payableFees: '',
    installments: '',
    confirmationChecked: false,
    enquiryOutcome: '',
    reasonForNotJoining: '',
    followUpDate: '',
    followUpOverview: '',
    followUpRemarks: '',
    confirmedRemark: '',
    demoTime: ''
  });
  const sigCanvasParentRef = useRef(null);
  const sigCanvasAdminRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'students'), limit(150));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(data);
    });
    return () => unsub();
  }, []);

  const handleStatusChange = async (studentId, newStatus) => {
    if (newStatus === 'dropped') {
      setPendingDropId(studentId);
      setDropReason('');
      setCustomDropReason('');
      setShowDropModal(true);
      return;
    }
    try {
      const dbStatus = newStatus === 'admitted' ? 'pending_admission' : newStatus;
      await updateDoc(doc(db, 'students', studentId), { status: dbStatus });
      if (newStatus === 'admitted') {
        alert("Student moved to Admitted list. The Front Desk can now complete their admission form.");
      }
      // Re-fetch or update selected student locally if needed
      setSelectedStudent(prev => prev && prev.id === studentId ? { ...prev, status: dbStatus } : prev);
      setActiveTab(newStatus); // Switch tab to show them
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleSaveCallLog = async () => {
    if (!newCallLogText.trim() || !activeNotesStudent) return;
    try {
      const studentId = activeNotesStudent.id;
      const newLog = {
        note: newCallLogText.trim(),
        date: new Date().toLocaleString(),
        timestamp: new Date().toISOString()
      };
      
      await updateDoc(doc(db, 'students', studentId), {
        callLogs: arrayUnion(newLog)
      });
      
      setNewCallLogText('');
      setActiveNotesStudent(prev => ({
        ...prev,
        callLogs: [...(prev.callLogs || []), newLog]
      }));
      alert("Call log saved successfully!");
    } catch (err) {
      console.error("Error saving call log:", err);
      alert("Failed to save call log.");
    }
  };

  const handleSavePhase2 = async () => {
    if (!activePhase2Student) return;
    if (!phase2Form.confirmationChecked) {
      alert("Please confirm the information is true by checking the box.");
      return;
    }
    
    let targetStatus = 'enquiry';
    if (phase2Form.enquiryOutcome === 'CONFIRMED') targetStatus = 'admitted';
    if (phase2Form.enquiryOutcome === 'DEMO SESSION') targetStatus = 'demo';
    if (phase2Form.enquiryOutcome === 'NOT CONFIRMED') targetStatus = 'dropped';

    try {
      const parentSig = sigCanvasParentRef.current?.isEmpty() ? '' : sigCanvasParentRef.current.getCanvas().toDataURL('image/png');
      const adminSig = sigCanvasAdminRef.current?.isEmpty() ? '' : sigCanvasAdminRef.current.getCanvas().toDataURL('image/png');

      const updates = {
        phase2Data: {
          ...phase2Form,
          parentSignaturePhase2: parentSig,
          adminSignaturePhase2: adminSig,
          processedAt: new Date().toISOString()
        },
        status: targetStatus
      };

      if (targetStatus === 'dropped') updates.dropReason = phase2Form.reasonForNotJoining;
      if (targetStatus === 'demo') updates.demoTime = phase2Form.demoTime;

      // Handle Follow Up Logging
      if (phase2Form.enquiryOutcome === 'FOLLOW UP' && phase2Form.followUpOverview) {
        updates.callLogs = arrayUnion({
          note: `FOLLOW UP (${phase2Form.followUpDate}): ${phase2Form.followUpOverview} - ${phase2Form.followUpRemarks}`,
          date: new Date().toLocaleString(),
          timestamp: new Date().toISOString()
        });
      }

      await updateDoc(doc(db, 'students', activePhase2Student.id), updates);
      
      setShowPhase2Modal(false);
      setActivePhase2Student(null);
      alert("Phase 2 successfully processed!");

      // Auto-Transition to Admission Form if Confirmed
      if (targetStatus === 'admitted') {
        await updateDoc(doc(db, 'students', activePhase2Student.id), { status: 'pending_admission' });
        alert("Student marked as confirmed! The Front Desk can now complete their admission form.");
      }
    } catch (err) {
      console.error("Error processing Phase 2:", err);
      alert("Failed to save Phase 2 details.");
    }
  };

  const handleDropSubmit = async () => {
    const reason = dropReason === 'Other' ? customDropReason.trim() : dropReason;
    if (!reason || !pendingDropId) return;

    try {
      await updateDoc(doc(db, 'students', pendingDropId), {
        status: 'dropped',
        dropReason: reason,
        droppedAt: new Date().toISOString()
      });
      setShowDropModal(false);
      setPendingDropId(null);
      setDropReason('');
      setCustomDropReason('');
      alert("Student status successfully changed to Dropped.");
    } catch (err) {
      console.error("Error logging drop:", err);
      alert("Failed to drop student.");
    }
  };



  // Helper: Get relevant batches for the active student's standard
  const getRelevantBatches = () => {
    if (!activePhase2Student) return [];
    const std = activePhase2Student.standard || '';
    if (std.includes('8th')) return BATCH_DEF['8th'];
    if (std.includes('9th')) return BATCH_DEF['9th'];
    if (std.includes('10th')) return BATCH_DEF['10th'];
    return [];
  };

  const relevantBatches = getRelevantBatches();

  // Helper: Calculate enrolled count for a specific batch
  const getBatchEnrollmentCount = (batchName) => {
    return students.filter(s => s.status === 'admitted' && s.batch === batchName).length;
  };

  // Helper: Get other demo students for the same standard
  const getDemoCohort = () => {
    if (!activePhase2Student) return [];
    const std = activePhase2Student.standard || '';
    return students.filter(s => s.status === 'demo' && s.standard === std && s.id !== activePhase2Student.id);
  };

  const currentTabStudents = students.filter(s => {
    if (activeTab === 'enquiry') return s.status === 'enquiry' || !s.status;
    if (activeTab === 'admitted') return s.status === 'admitted' || s.status === 'pending_admission';
    return s.status === activeTab;
  });

  return (
    <div className="crm-container">
      <div className="crm-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1>Admission Pipeline</h1>
            <p>Select a stage to view leads and manage conversions.</p>
          </div>
        </div>

        <div className="crm-tabs">
          {COLUMNS.map(col => {
            const count = students.filter(s => {
              if (col.id === 'enquiry') return s.status === 'enquiry' || !s.status;
              if (col.id === 'admitted') return s.status === 'admitted' || s.status === 'pending_admission';
              return s.status === col.id;
            }).length;
            return (
              <button 
                key={col.id} 
                className={`crm-tab ${activeTab === col.id ? 'active' : ''}`}
                onClick={() => { setActiveTab(col.id); setSelectedStudent(null); }}
              >
                {col.title} <span className="tab-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="crm-split-layout">
        <div className="crm-list-panel">
          {currentTabStudents.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>No students in this stage.</div>
          ) : (
            currentTabStudents.map(student => (
              <div 
                key={student.id} 
                className={`crm-list-item ${selectedStudent?.id === student.id ? 'active' : ''}`}
                onClick={() => setSelectedStudent(student)}
              >
                <div className="crm-list-item-header">
                  <strong>{student.studentName || 'Unknown'}</strong>
                  <span className="item-date">{student.enquiryDate || 'New'}</span>
                </div>
                <div className="crm-list-item-sub">
                  <span>{student.assignedCouncillor || 'Unassigned'}</span>
                  <span>{student.contactNo || student.contactNumber || 'No phone'}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="crm-detail-panel">
          {!selectedStudent ? (
            <div className="empty-state" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Select a student from the list to view details and take action.
            </div>
          ) : (
            <div className="crm-detail-content">
              <div className="detail-header-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: '24px', margin: '0 0 8px 0' }}>{selectedStudent.studentName}</h2>
                    <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>call</span> {selectedStudent.contactNo || selectedStudent.contactNumber}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>person</span> {selectedStudent.assignedCouncillor || 'Unassigned'}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-actions" style={{ display: 'flex', gap: '8px', marginTop: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--surface-border)' }}>
                  <button className="btn btn-ghost" onClick={() => { setActiveNotesStudent(selectedStudent); setShowNotesModal(true); }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>note_add</span> Call Logs ({selectedStudent.callLogs?.length || 0})
                  </button>
                  {(!selectedStudent.status || selectedStudent.status === 'enquiry') && (
                    <button className="btn btn-brand" style={{ background: '#4caf50', borderColor: '#4caf50' }} onClick={() => { setActivePhase2Student(selectedStudent); setShowPhase2Modal(true); }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>admin_panel_settings</span> Phase 2 Form
                    </button>
                  )}
                  
                  {selectedStudent.status === 'demo' && (
                    <button className="btn btn-brand" onClick={() => handleStatusChange(selectedStudent.id, 'admitted')}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>verified</span> Mark Admitted
                    </button>
                  )}

                  {selectedStudent.status !== 'dropped' && selectedStudent.status !== 'admitted' && (
                    <button className="btn btn-brand btn-danger" onClick={() => handleStatusChange(selectedStudent.id, 'dropped')}>
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span> Drop Lead
                    </button>
                  )}
                </div>
              </div>

              {/* Extended Details */}
              <div className="detail-body" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {selectedStudent.status === 'demo' && (
                  <div className="info-card">
                    <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      Demo Session Status
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                      {['day1', 'day2', 'day3'].map((dayKey, idx) => {
                        const dayData = selectedStudent.demoSchedule?.[dayKey];
                        const isPresent = dayData?.attendance === 'present';
                        const isAbsent = dayData?.attendance === 'absent';
                        
                        let bgColor = 'var(--surface-bg)';
                        let borderColor = 'var(--surface-border)';
                        let color = 'var(--text-secondary)';

                        if (isPresent) {
                          bgColor = 'rgba(76, 175, 80, 0.1)';
                          borderColor = '#4caf50';
                          color = '#4caf50';
                        } else if (isAbsent) {
                          bgColor = 'rgba(244, 67, 54, 0.1)';
                          borderColor = '#f44336';
                          color = '#f44336';
                        }

                        return (
                          <div
                            key={dayKey}
                            style={{
                              padding: '8px 16px', borderRadius: '8px', border: `1px solid ${borderColor}`,
                              background: bgColor, color: color,
                              fontWeight: 600, fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1
                            }}
                          >
                            <span>Day {idx + 1}</span>
                            <span style={{ fontSize: '11px', marginTop: '4px', fontWeight: 'normal' }}>
                              {dayData?.date ? dayData.date : 'Not Scheduled'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="info-card">
                  <h3>Lead Information</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px', fontSize: '14px' }}>
                    <div><strong style={{ color: 'var(--text-secondary)' }}>Enquiry Date:</strong><br />{selectedStudent.enquiryDate || 'N/A'}</div>
                    <div><strong style={{ color: 'var(--text-secondary)' }}>Source:</strong><br />{selectedStudent.enquiryType || 'N/A'}</div>
                    <div><strong style={{ color: 'var(--text-secondary)' }}>Standard:</strong><br />{selectedStudent.standard || 'N/A'}</div>
                    <div><strong style={{ color: 'var(--text-secondary)' }}>School:</strong><br />{selectedStudent.schoolName || 'N/A'}</div>
                    <div style={{ gridColumn: '1 / -1' }}><strong style={{ color: 'var(--text-secondary)' }}>Address:</strong><br />{selectedStudent.address || 'N/A'}</div>
                  </div>
                </div>

                {selectedStudent.dropReason && (
                  <div className="info-card" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <h3 style={{ color: 'var(--status-error)' }}>Drop Reason</h3>
                    <p style={{ marginTop: '8px', fontWeight: 'bold' }}>{selectedStudent.dropReason}</p>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* 📞 Call Notes / Logs Modal */}
      {showNotesModal && activeNotesStudent && (
        <div className="admission-modal-overlay">
          <div className="admission-modal" style={{ maxWidth: '600px' }}>
            <h2 className="modal-title">📞 Call Follow-up Logs: {activeNotesStudent.studentName}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Log discussion details for future reference.</p>
            
            <div className="notes-history">
              {(!activeNotesStudent.callLogs || activeNotesStudent.callLogs.length === 0) ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '32px', opacity: 0.5, marginBottom: '8px' }}>chat_bubble_outline</span>
                  <p style={{ fontSize: '13px' }}>No call logs yet.</p>
                </div>
              ) : (
                activeNotesStudent.callLogs.map((log, idx) => (
                  <div key={idx} className="log-item">
                    <div className="log-item-meta">
                      <strong>Log #{idx + 1}</strong>
                      <span>{log.date}</span>
                    </div>
                    <p className="log-item-text">{log.note}</p>
                  </div>
                ))
              )}
            </div>

            <div className="modal-form-group">
              <label className="form-label">Add Note</label>
              <textarea
                rows={3}
                placeholder="Log details of the conversation with parents..."
                value={newCallLogText}
                onChange={e => setNewCallLogText(e.target.value)}
                className="portal-input"
              />
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setShowNotesModal(false); setActiveNotesStudent(null); setNewCallLogText(''); }}>Close</button>
              <button className="btn btn-brand" onClick={handleSaveCallLog} disabled={!newCallLogText.trim()}>Save Note</button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 2 Processing Modal */}
      {showPhase2Modal && activePhase2Student && (
        <div className="admission-modal-overlay">
          <div className="admission-modal" style={{ maxWidth: '1000px', width: '95%', maxHeight: '95vh', overflowY: 'auto', position: 'relative' }}>
            
            {/* Close Button */}
            <button 
              type="button"
              className="btn btn-ghost" 
              style={{ position: 'absolute', top: '16px', right: '16px', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setShowPhase2Modal(false)}
              title="Close Modal"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h2 className="modal-title">Phase 2: Administrative Processing</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Fee discussion and final outcome for <strong>{activePhase2Student.studentName}</strong></p>
            
            {/* Phase 1 Summary View */}
            <div className="form-section" style={{ background: 'var(--surface-bg)', border: '1px solid var(--surface-border)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
              <h3 className="form-section-title" style={{ fontSize: '14px', marginBottom: '12px' }}>Phase 1 Details (Submitted by Front Desk)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div><strong>Shishya Contact:</strong> {activePhase2Student.contactNo}</div>
                <div><strong>Address:</strong> {activePhase2Student.address}</div>
                <div><strong>Parent Name:</strong> {activePhase2Student.parentName || 'N/A'}</div>
                <div><strong>Parent Contact:</strong> {activePhase2Student.parentContact || 'N/A'} {activePhase2Student.parentEmail ? ` / ${activePhase2Student.parentEmail}` : ''}</div>
                <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--surface-border)', paddingTop: '8px', marginTop: '4px' }}></div>
                <div><strong>Enquiry Type:</strong> {activePhase2Student.enquiryType === 'in_house' ? 'In-House (Renewal)' : 'New Admission'}</div>
                <div><strong>Reference:</strong> {activePhase2Student.reference} {activePhase2Student.reference === 'sk_student' && `(${activePhase2Student.referringStudentName})`}</div>
                <div><strong>School:</strong> {activePhase2Student.schoolName} ({activePhase2Student.standard} - {activePhase2Student.board})</div>
                <div><strong>Dispersal Time:</strong> {activePhase2Student.dispersalTime || 'N/A'}</div>
                <div><strong>Prev. Score:</strong> {activePhase2Student.prevClassPercent || 'N/A'}</div>
                <div><strong>Prev. Tuition:</strong> {activePhase2Student.prevTuition || 'N/A'}</div>
                <div style={{ gridColumn: 'span 2' }}><strong>Reason for Leaving:</strong> {activePhase2Student.reasonForLeaving || 'N/A'}</div>
                <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--surface-border)', paddingTop: '8px', marginTop: '4px' }}></div>
                <div><strong>Languages:</strong> {activePhase2Student.languages?.join(', ') || 'N/A'}</div>
                <div><strong>Core Maths:</strong> {activePhase2Student.coreMaths === 'standard' ? 'Standard' : 'Basic'}</div>
                <div><strong>Other Core:</strong> {[activePhase2Student.coreScience && 'Science', activePhase2Student.coreSocial && 'Social Science'].filter(Boolean).join(', ') || 'None'}</div>
                <div><strong>Technology:</strong> {activePhase2Student.technologies?.join(', ') || 'None'}</div>
                <div style={{ gridColumn: 'span 2' }}><strong>Time Slots:</strong> {activePhase2Student.preferredSlots?.join(' & ') || 'N/A'}</div>
              </div>
            </div>

            <div className="form-section" style={{ padding: 0, border: 'none', background: 'transparent' }}>
              <h3 className="form-section-title" style={{ fontSize: '14px', marginBottom: '12px' }}>Fees Discussion</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Course Fees</label>
                  <input type="number" className="portal-input" value={phase2Form.courseFees} onChange={e => setPhase2Form({...phase2Form, courseFees: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Discount</label>
                  <input type="number" className="portal-input" value={phase2Form.discount} onChange={e => setPhase2Form({...phase2Form, discount: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Payable Fees</label>
                  <input type="number" className="portal-input" value={phase2Form.payableFees} onChange={e => setPhase2Form({...phase2Form, payableFees: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>No. of Installments</label>
                  <input type="text" className="portal-input" placeholder="e.g. 3 Months" value={phase2Form.installments} onChange={e => setPhase2Form({...phase2Form, installments: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '20px', marginBottom: '20px' }}>
              <label className="checkbox-item" style={{ fontSize: '13px', fontWeight: 600 }}>
                <input type="checkbox" checked={phase2Form.confirmationChecked} onChange={e => setPhase2Form({...phase2Form, confirmationChecked: e.target.checked})} />
                I THE UNDERSIGN CONFIRM THAT ALL THE INFORMATION PROVIDED IS TRUE AND CORRECT TO THE BEST OF MY KNOWLEDGE
              </label>
            </div>

            <div className="form-grid" style={{ marginBottom: '20px' }}>
              <div>
                <label className="form-label">Parent / Guardian Signature</label>
                <div style={{ border: '2px dashed var(--surface-border)', borderRadius: '8px', background: 'var(--surface-bg)', overflow: 'hidden' }}>
                  <SignatureCanvas ref={sigCanvasParentRef} penColor="black" backgroundColor="white" canvasProps={{ width: 300, height: 150, style: { width: '100%', height: '150px', cursor: 'crosshair' } }} />
                </div>
                <button className="btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => sigCanvasParentRef.current?.clear()}>Clear</button>
              </div>
              <div>
                <label className="form-label">Administrative Head Signature</label>
                <div style={{ border: '2px dashed var(--surface-border)', borderRadius: '8px', background: 'var(--surface-bg)', overflow: 'hidden' }}>
                  <SignatureCanvas ref={sigCanvasAdminRef} penColor="black" backgroundColor="white" canvasProps={{ width: 300, height: 150, style: { width: '100%', height: '150px', cursor: 'crosshair' } }} />
                </div>
                <button className="btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => sigCanvasAdminRef.current?.clear()}>Clear</button>
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Enquiry Outcome</h3>
              <div className="form-grid">
                <div className="form-group full-width checkbox-group" style={{ display: 'flex', gap: '16px' }}>
                  {['CONFIRMED', 'FOLLOW UP', 'DEMO SESSION', 'NOT CONFIRMED'].map(outcome => (
                    <label key={outcome} className="checkbox-item">
                      <input type="radio" name="enquiryOutcome" value={outcome} checked={phase2Form.enquiryOutcome === outcome} onChange={e => setPhase2Form({...phase2Form, enquiryOutcome: e.target.value})} />
                      {outcome}
                    </label>
                  ))}
                </div>
                
                {/* Conditional Outcomes */}
                {phase2Form.enquiryOutcome === 'CONFIRMED' && (
                  <div className="form-group full-width" style={{ marginTop: '16px', background: 'rgba(34, 197, 94, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                    <h4 style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-primary)' }}>Batch Availability ({activePhase2Student.standard})</h4>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {relevantBatches.map(batch => {
                        const count = getBatchEnrollmentCount(batch);
                        const isFull = count >= 22;
                        return (
                          <div key={batch} style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '4px', background: isFull ? 'rgba(239, 68, 68, 0.1)' : 'var(--surface-bg)', border: `1px solid ${isFull ? 'var(--status-error)' : 'var(--surface-border)'}`, color: isFull ? 'var(--status-error)' : 'inherit' }}>
                            <strong>{batch}</strong>: {count}/22
                          </div>
                        );
                      })}
                    </div>
                    <label>Confirmation Remarks</label>
                    <textarea className="portal-input" rows={2} placeholder="Notes about confirmation..." value={phase2Form.confirmedRemark} onChange={e => setPhase2Form({...phase2Form, confirmedRemark: e.target.value})} />
                  </div>
                )}

                {phase2Form.enquiryOutcome === 'FOLLOW UP' && (
                  <div className="form-group full-width" style={{ marginTop: '16px' }}>
                    <div style={{ background: 'var(--surface-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)', marginBottom: '16px' }}>
                      <h4 style={{ marginBottom: '8px', fontSize: '13px' }}>Past Follow-ups</h4>
                      <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '12px' }}>
                        {(!activePhase2Student.callLogs || activePhase2Student.callLogs.length === 0) ? (
                          <p style={{ color: 'var(--text-muted)' }}>No previous follow-ups logged.</p>
                        ) : (
                          activePhase2Student.callLogs.map((log, idx) => (
                            <div key={idx} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--surface-border)' }}>
                              <strong>{log.date}:</strong> {log.note}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="form-grid" style={{ gridTemplateColumns: '1fr 2fr 2fr', gap: '12px' }}>
                      <div className="form-group"><label>Next Date</label><input type="date" className="portal-input" value={phase2Form.followUpDate} onChange={e => setPhase2Form({...phase2Form, followUpDate: e.target.value})} /></div>
                      <div className="form-group"><label>Overview</label><input type="text" className="portal-input" placeholder="e.g. Needs more time" value={phase2Form.followUpOverview} onChange={e => setPhase2Form({...phase2Form, followUpOverview: e.target.value})} /></div>
                      <div className="form-group"><label>Remarks</label><input type="text" className="portal-input" placeholder="Additional notes" value={phase2Form.followUpRemarks} onChange={e => setPhase2Form({...phase2Form, followUpRemarks: e.target.value})} /></div>
                    </div>
                  </div>
                )}

                {phase2Form.enquiryOutcome === 'DEMO SESSION' && (
                  <div className="form-group full-width" style={{ marginTop: '16px' }}>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label>Set Demo Time for {activePhase2Student.studentName}</label>
                      <input type="text" className="portal-input" placeholder="e.g. Tomorrow 4:00 PM" value={phase2Form.demoTime} onChange={e => setPhase2Form({...phase2Form, demoTime: e.target.value})} />
                    </div>
                    
                    <h4 style={{ marginBottom: '8px', fontSize: '13px' }}>Current Demo Cohort ({activePhase2Student.standard})</h4>
                    <div className="table-responsive" style={{ border: '1px solid var(--surface-border)', borderRadius: '8px' }}>
                      <table className="portal-table" style={{ width: '100%', fontSize: '12px', textAlign: 'left' }}>
                        <thead style={{ background: 'var(--surface-bg)' }}>
                          <tr>
                            <th style={{ padding: '8px' }}>Name</th>
                            <th style={{ padding: '8px' }}>Contact</th>
                            <th style={{ padding: '8px' }}>School</th>
                            <th style={{ padding: '8px' }}>Demo Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getDemoCohort().length === 0 ? (
                            <tr><td colSpan="4" style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)' }}>No other students currently in Demo for this standard.</td></tr>
                          ) : (
                            getDemoCohort().map(s => (
                              <tr key={s.id} style={{ borderTop: '1px solid var(--surface-border)' }}>
                                <td style={{ padding: '8px' }}>{s.studentName}</td>
                                <td style={{ padding: '8px' }}>{s.contactNo}</td>
                                <td style={{ padding: '8px' }}>{s.schoolName}</td>
                                <td style={{ padding: '8px' }}>{s.demoTime || 'Not Set'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {phase2Form.enquiryOutcome === 'NOT CONFIRMED' && (
                  <div className="form-group full-width" style={{ marginTop: '16px' }}>
                    <label>Reason for not joining</label>
                    <textarea className="portal-input" rows={2} value={phase2Form.reasonForNotJoining} onChange={e => setPhase2Form({...phase2Form, reasonForNotJoining: e.target.value})} />
                  </div>
                )}
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '24px', fontWeight: 700, color: 'var(--brand-primary)' }}>
              || जय हिन्द जय भारत ||
            </div>

            <div className="modal-footer" style={{ marginTop: '24px' }}>
              <button className="btn btn-ghost" onClick={() => setShowPhase2Modal(false)}>Cancel</button>
              <button className="btn btn-brand" onClick={handleSavePhase2}>Process Outcome</button>
            </div>
          </div>
        </div>
      )}

      {/* 🛑 Drop Student Modal */}
      {showDropModal && (
        <div className="admission-modal-overlay">
          <div className="admission-modal">
            <h2 className="modal-title">🛑 Drop Enquiry</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Why did this student choose not to enroll in Shishyakul?</p>
            
            <div className="modal-form-group">
              <label className="form-label">Drop Reason</label>
              <select value={dropReason} onChange={e => setDropReason(e.target.value)} className="portal-select">
                <option value="">Select a reason...</option>
                <option value="Fees issue">Fees / Discount issue</option>
                <option value="Joined elsewhere">Joined another coaching</option>
                <option value="Timings issue">Class timing clashes</option>
                <option value="Distance/Travel issue">Distance is too far</option>
                <option value="Not interested anymore">Not interested anymore</option>
                <option value="Other">Other (Specify below)</option>
              </select>
            </div>

            {dropReason === 'Other' && (
              <div className="modal-form-group">
                <label className="form-label">Custom Reason Details</label>
                <textarea
                  rows={2}
                  placeholder="Detail the parent's feedback..."
                  value={customDropReason}
                  onChange={e => setCustomDropReason(e.target.value)}
                  className="portal-input"
                />
              </div>
            )}

            <div className="modal-footer">
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowDropModal(false);
                  setPendingDropId(null);
                  setDropReason('');
                  setCustomDropReason('');
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-brand btn-danger" 
                onClick={handleDropSubmit}
                disabled={!dropReason || (dropReason === 'Other' && !customDropReason.trim())}
              >
                Submit & Drop
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
