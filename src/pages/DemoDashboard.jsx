import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import './DemoDashboard.css';

export default function DemoDashboard() {
  const [demoStudents, setDemoStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeStudentForSchedule, setActiveStudentForSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ day1: '', day2: '', day3: '' });

  // State for Enquiry View Modal
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [activeEnquiryStudent, setActiveEnquiryStudent] = useState(null);

  useEffect(() => {
    // Fetch all students who are in 'demo' status
    const q = query(collection(db, 'students'), where('status', '==', 'demo'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      
      // Sort by creation date descending (newest first)
      data.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });

      setDemoStudents(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Handlers for Demo Actions
  const handleOpenSchedule = (student) => {
    setActiveStudentForSchedule(student);
    const schedule = student.demoSchedule || {};
    setScheduleForm({
      day1: schedule.day1?.date || '',
      day2: schedule.day2?.date || '',
      day3: schedule.day3?.date || ''
    });
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    if (!activeStudentForSchedule) return;
    try {
      const existingSchedule = activeStudentForSchedule.demoSchedule || {};
      const newSchedule = {
        ...existingSchedule,
        day1: { ...existingSchedule.day1, date: scheduleForm.day1, attendance: existingSchedule.day1?.attendance || 'pending' },
        day2: { ...existingSchedule.day2, date: scheduleForm.day2, attendance: existingSchedule.day2?.attendance || 'pending' },
        day3: { ...existingSchedule.day3, date: scheduleForm.day3, attendance: existingSchedule.day3?.attendance || 'pending' }
      };

      await updateDoc(doc(db, 'students', activeStudentForSchedule.id), {
        demoSchedule: newSchedule
      });

      setShowScheduleModal(false);
      setActiveStudentForSchedule(null);
    } catch (err) {
      console.error("Error saving schedule:", err);
      alert("Failed to save schedule.");
    }
  };

  const handleMarkAttendance = async (studentId, dayKey, status) => {
    const student = demoStudents.find(s => s.id === studentId);
    if (!student) return;

    try {
      const schedule = student.demoSchedule || {};
      const updatedSchedule = {
        ...schedule,
        [dayKey]: {
          ...schedule[dayKey],
          attendance: status
        }
      };

      // Check if all 3 days are completed
      const allCompleted = 
        updatedSchedule.day1?.attendance !== 'pending' && updatedSchedule.day1?.attendance &&
        updatedSchedule.day2?.attendance !== 'pending' && updatedSchedule.day2?.attendance &&
        updatedSchedule.day3?.attendance !== 'pending' && updatedSchedule.day3?.attendance;

      await updateDoc(doc(db, 'students', studentId), {
        demoSchedule: updatedSchedule,
        demoCompletionStatus: allCompleted ? 'completed' : 'in_progress'
      });
    } catch (err) {
      console.error("Error updating attendance:", err);
    }
  };

  const handleConvertAction = async (studentId, action) => {
    try {
      if (action === 'admit') {
        await updateDoc(doc(db, 'students', studentId), {
          status: 'admitted',
          demoCompletionStatus: 'converted',
          demoConvertedAt: new Date().toISOString()
        });
        alert("Student converted to Admitted!");
      } else if (action === 'drop') {
        const reason = prompt("Enter drop reason:");
        if (reason === null) return;
        await updateDoc(doc(db, 'students', studentId), {
          status: 'dropped',
          dropReason: reason || 'Dropped from Demo',
          demoCompletionStatus: 'dropped',
          droppedAt: new Date().toISOString()
        });
      } else if (action === 'log_call') {
        const note = prompt("Enter follow-up call note:");
        if (!note) return;
        await updateDoc(doc(db, 'students', studentId), {
          callLogs: arrayUnion({
            note: `DEMO FOLLOW-UP: ${note}`,
            date: new Date().toLocaleString(),
            timestamp: new Date().toISOString()
          })
        });
        alert("Call log saved.");
      } else if (action === 'extra_demo') {
        const student = demoStudents.find(s => s.id === studentId);
        if (!student) return;
        const extraDate = prompt("Enter date for extra demo (YYYY-MM-DD):");
        if (!extraDate) return;
        
        const schedule = student.demoSchedule || {};
        const extraDays = schedule.extraDays || [];
        extraDays.push({ date: extraDate, attendance: 'pending' });
        
        await updateDoc(doc(db, 'students', studentId), {
          demoSchedule: { ...schedule, extraDays },
          demoCompletionStatus: 'in_progress' // push back to in progress
        });
      }
    } catch (err) {
      console.error("Error executing action:", err);
      alert("Failed to execute action.");
    }
  };

  // Widget Calculations
  const totalDemos = demoStudents.length;
  const completedDemos = demoStudents.filter(s => s.demoCompletionStatus === 'completed').length;
  const thisWeekCount = demoStudents.filter(s => {
    if (!s.createdAt) return false;
    const addedDate = s.createdAt.toDate();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return addedDate >= oneWeekAgo;
  }).length;

  return (
    <div>
      <div className="page-header" style={{ paddingBottom: 16 }}>
        <div>
          <h1 className="page-title">Demo Session Dashboard</h1>
          <p className="page-subtitle">Track schedules, mark attendance, and manage conversions.</p>
        </div>
      </div>

      {/* Widgets Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--surface-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>Active Demos</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--brand-primary)' }}>{totalDemos}</div>
        </div>

        <div style={{ background: 'var(--surface-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--status-error)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: 'var(--status-error)', fontSize: '13px', fontWeight: 600 }}>Follow-up Required (Completed Demos)</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--status-error)' }}>{completedDemos}</div>
        </div>

        <div style={{ background: 'var(--surface-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>Added This Week</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--status-success)' }}>+{thisWeekCount}</div>
        </div>
      </div>

      {/* Demo Cards Grid */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</div>
      ) : demoStudents.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No students currently in demo.</div>
      ) : (
        <div className="demo-grid">
          {demoStudents.map(student => {
            const schedule = student.demoSchedule || {};
            const isCompleted = student.demoCompletionStatus === 'completed';

            const renderDayRow = (dayKey, label, data) => (
              <div className="demo-day-row" key={dayKey}>
                <div className="demo-day-label">
                  {label}
                  {data?.date ? <span className="demo-day-date">{data.date}</span> : <span className="demo-day-date" style={{ color: 'var(--status-error)' }}>Not set</span>}
                </div>
                <div className="demo-actions">
                  {data?.date ? (
                    <>
                      <button 
                        className={`btn-demo-action present ${data.attendance === 'present' ? 'active' : ''}`}
                        onClick={() => handleMarkAttendance(student.id, dayKey, 'present')}
                      >
                        Present
                      </button>
                      <button 
                        className={`btn-demo-action absent ${data.attendance === 'absent' ? 'active' : ''}`}
                        onClick={() => handleMarkAttendance(student.id, dayKey, 'absent')}
                      >
                        Absent
                      </button>
                    </>
                  ) : (
                    <button className="btn-demo-action schedule" onClick={() => handleOpenSchedule(student)}>
                      Schedule
                    </button>
                  )}
                </div>
              </div>
            );

            return (
              <div className="demo-card" key={student.id} style={{ borderColor: isCompleted ? 'var(--status-error)' : 'var(--surface-border)' }}>
                <div className="demo-header">
                  <div>
                    <div className="demo-name">{student.studentName}</div>
                    <div className="demo-meta">{student.standard} - {student.board} • {student.contactNo}</div>
                  </div>
                  <div className={`demo-status-badge ${isCompleted ? 'needs_followup' : 'in_progress'}`}>
                    {isCompleted ? 'Needs Follow Up' : 'In Progress'}
                  </div>
                </div>

                <div className="demo-meta" style={{ display: 'flex', gap: '16px', background: 'var(--bg-color)', padding: '8px 12px', borderRadius: '8px' }}>
                  <div><strong>Parent:</strong> {student.parentName || 'N/A'}</div>
                  <div><strong>Time:</strong> {student.demoTime || 'N/A'}</div>
                </div>

                <div className="demo-timeline">
                  {renderDayRow('day1', 'Day 1', schedule.day1)}
                  {renderDayRow('day2', 'Day 2', schedule.day2)}
                  {renderDayRow('day3', 'Day 3', schedule.day3)}
                  
                  {/* Extra Days */}
                  {(schedule.extraDays || []).map((extraDay, idx) => (
                    <div className="demo-day-row" key={`extra_${idx}`}>
                      <div className="demo-day-label">
                        Extra {idx + 1}
                        <span className="demo-day-date">{extraDay.date}</span>
                      </div>
                      <div className="demo-actions">
                        <button 
                          className={`btn-demo-action present ${extraDay.attendance === 'present' ? 'active' : ''}`}
                          onClick={() => {
                            const newExtra = [...schedule.extraDays];
                            newExtra[idx].attendance = 'present';
                            updateDoc(doc(db, 'students', student.id), { demoSchedule: { ...schedule, extraDays: newExtra } });
                          }}
                        >Present</button>
                        <button 
                          className={`btn-demo-action absent ${extraDay.attendance === 'absent' ? 'active' : ''}`}
                          onClick={() => {
                            const newExtra = [...schedule.extraDays];
                            newExtra[idx].attendance = 'absent';
                            updateDoc(doc(db, 'students', student.id), { demoSchedule: { ...schedule, extraDays: newExtra } });
                          }}
                        >Absent</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="demo-footer-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setActiveEnquiryStudent(student);
                    setShowEnquiryModal(true);
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>visibility</span> View Enquiry
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleOpenSchedule(student)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_calendar</span> Set Dates
                  </button>
                </div>

                {isCompleted && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--status-error)' }}>Demo Complete! Conversion Action Required:</div>
                    <div className="demo-footer-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => handleConvertAction(student.id, 'log_call')}>Log Call</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleConvertAction(student.id, 'extra_demo')}>+ Extra Demo</button>
                    </div>
                    <div className="demo-footer-actions">
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--status-error)' }} onClick={() => handleConvertAction(student.id, 'drop')}>Drop</button>
                      <button className="btn btn-brand btn-sm" onClick={() => handleConvertAction(student.id, 'admit')}>Convert to Admitted</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Dates Modal */}
      {showScheduleModal && activeStudentForSchedule && (
        <div className="admission-modal-overlay">
          <div className="admission-modal" style={{ maxWidth: '400px' }}>
            <h2 className="modal-title">Schedule Demo Dates</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Set the dates for {activeStudentForSchedule.studentName}'s demo lectures.</p>
            
            <div className="modal-form-group">
              <label className="form-label">Day 1 Date</label>
              <input type="date" className="portal-input" value={scheduleForm.day1} onChange={e => setScheduleForm({...scheduleForm, day1: e.target.value})} />
            </div>
            <div className="modal-form-group">
              <label className="form-label">Day 2 Date</label>
              <input type="date" className="portal-input" value={scheduleForm.day2} onChange={e => setScheduleForm({...scheduleForm, day2: e.target.value})} />
            </div>
            <div className="modal-form-group">
              <label className="form-label">Day 3 Date</label>
              <input type="date" className="portal-input" value={scheduleForm.day3} onChange={e => setScheduleForm({...scheduleForm, day3: e.target.value})} />
            </div>

            <div className="modal-footer" style={{ marginTop: '24px' }}>
              <button className="btn btn-ghost" onClick={() => setShowScheduleModal(false)}>Cancel</button>
              <button className="btn btn-brand" onClick={handleSaveSchedule}>Save Schedule</button>
            </div>
          </div>
        </div>
      )}

      {/* View Enquiry Form Modal (Read/Write) */}
      {showEnquiryModal && activeEnquiryStudent && (
        <div className="admission-modal-overlay">
          <div className="admission-modal enquiry-view-modal">
            <button 
              type="button"
              className="btn btn-ghost" 
              style={{ position: 'absolute', top: '16px', right: '16px', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setShowEnquiryModal(false)}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <h2 className="modal-title">Phase 1 & 2 Enquiry Data</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Viewing records for {activeEnquiryStudent.studentName}</p>

            <div className="form-section" style={{ background: 'var(--surface-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--surface-border)', marginBottom: '16px' }}>
              <h3 className="form-section-title" style={{ fontSize: '14px', marginBottom: '12px' }}>Phase 1: Basic Details & Contact (Editable)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div className="form-group">
                  <label>Shishya Contact</label>
                  <input type="text" className="portal-input" value={activeEnquiryStudent.contactNo || ''} onChange={e => setActiveEnquiryStudent({...activeEnquiryStudent, contactNo: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Parent Phone</label>
                  <input type="text" className="portal-input" value={activeEnquiryStudent.parentContact || ''} onChange={e => setActiveEnquiryStudent({...activeEnquiryStudent, parentContact: e.target.value})} />
                </div>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Address</label>
                  <input type="text" className="portal-input" value={activeEnquiryStudent.address || ''} onChange={e => setActiveEnquiryStudent({...activeEnquiryStudent, address: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="form-section" style={{ background: 'var(--surface-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--surface-border)', marginBottom: '16px' }}>
              <h3 className="form-section-title" style={{ fontSize: '14px', marginBottom: '12px' }}>Phase 1: Academic & Subjects</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                <div><strong>Parent Name:</strong> {activeEnquiryStudent.parentName || 'N/A'} {activeEnquiryStudent.parentEmail ? ` / ${activeEnquiryStudent.parentEmail}` : ''}</div>
                <div><strong>Enquiry Type:</strong> {activeEnquiryStudent.enquiryType === 'in_house' ? 'In-House (Renewal)' : 'New Admission'}</div>
                
                <div><strong>School Name:</strong> {activeEnquiryStudent.schoolName}</div>
                <div><strong>Standard & Board:</strong> {activeEnquiryStudent.standard} {activeEnquiryStudent.board}</div>
                
                <div><strong>Reference:</strong> {activeEnquiryStudent.reference} {activeEnquiryStudent.reference === 'sk_student' && `(${activeEnquiryStudent.referringStudentName})`}</div>
                <div><strong>Dispersal Time:</strong> {activeEnquiryStudent.dispersalTime || 'N/A'}</div>
                
                <div><strong>Prev. Class Score:</strong> {activeEnquiryStudent.prevClassPercent || 'N/A'}</div>
                <div><strong>Prev. Tuition/Coaching:</strong> {activeEnquiryStudent.prevTuition || 'N/A'}</div>
                <div style={{ gridColumn: 'span 2' }}><strong>Reason for Leaving:</strong> {activeEnquiryStudent.reasonForLeaving || 'N/A'}</div>
                
                <div style={{ gridColumn: 'span 2', borderTop: '1px dashed var(--surface-border)', paddingTop: '8px', marginTop: '4px' }}></div>
                
                <div><strong>Languages:</strong> {activeEnquiryStudent.languages?.join(', ') || 'N/A'}</div>
                <div><strong>Core Maths:</strong> {activeEnquiryStudent.coreMaths === 'standard' ? 'Standard' : 'Basic'}</div>
                <div><strong>Other Core Subjects:</strong> {[activeEnquiryStudent.coreScience && 'Science', activeEnquiryStudent.coreSocial && 'Social Science'].filter(Boolean).join(', ') || 'None'}</div>
                <div><strong>Technology Subjects:</strong> {activeEnquiryStudent.technologies?.join(', ') || 'None'}</div>
                <div style={{ gridColumn: 'span 2' }}><strong>Preferred Time Slots:</strong> {activeEnquiryStudent.preferredSlots?.join(' & ') || 'N/A'}</div>
              </div>
            </div>

            <div className="form-section" style={{ background: 'var(--surface-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
              <h3 className="form-section-title" style={{ fontSize: '14px', marginBottom: '12px' }}>Phase 2: Administrative Discussion</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                {activeEnquiryStudent.phase2Data ? (
                  <>
                    <div><strong>Course Fees Discussed:</strong> ₹{activeEnquiryStudent.phase2Data.courseFees}</div>
                    <div><strong>Discount Offered:</strong> ₹{activeEnquiryStudent.phase2Data.discount}</div>
                    <div><strong>Payable Fees:</strong> ₹{activeEnquiryStudent.phase2Data.payableFees}</div>
                    <div><strong>Installments Discussed:</strong> {activeEnquiryStudent.phase2Data.installments}</div>
                    <div style={{ gridColumn: 'span 2', borderTop: '1px dashed var(--surface-border)', paddingTop: '8px', marginTop: '4px' }}></div>
                    <div><strong>Initial Enquiry Outcome:</strong> {activeEnquiryStudent.phase2Data.enquiryOutcome}</div>
                    <div><strong>Phase 2 Processed At:</strong> {activeEnquiryStudent.phase2Data.processedAt ? new Date(activeEnquiryStudent.phase2Data.processedAt).toLocaleString() : 'N/A'}</div>
                  </>
                ) : (
                  <div style={{ gridColumn: 'span 2', color: 'var(--status-error)' }}>Phase 2 data was not completed before Demo.</div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: '24px' }}>
              <button className="btn btn-ghost" onClick={() => setShowEnquiryModal(false)}>Close</button>
              <button className="btn btn-brand" onClick={async () => {
                await updateDoc(doc(db, 'students', activeEnquiryStudent.id), {
                  contactNo: activeEnquiryStudent.contactNo,
                  parentContact: activeEnquiryStudent.parentContact,
                  address: activeEnquiryStudent.address
                });
                alert("Enquiry Details updated!");
                setShowEnquiryModal(false);
              }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
