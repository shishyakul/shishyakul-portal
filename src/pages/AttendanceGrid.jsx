import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './AttendanceGrid.css';

const BATCH_DEF = {
  '8th': [
    '8th-CBSE Alpha', '8th-CBSE Bravo', '8th-CBSE Delta', '8th-CBSE Echo'
  ],
  '9th': [
    '9th-CBSE Alpha', '9th-CBSE Bravo', '9th-CBSE Charlie', '9th-CBSE Echo', '9th-CBSE Foxtrot', '9th-State Delta'
  ],
  '10th': [
    '10th-CBSE Alpha', '10th-CBSE Bravo', '10th-CBSE Charlie', '10th-CBSE Delta', '10th-CBSE Echo', '10th-CBSE Foxtrot', '10th-State Hitman', '10th-State Golf'
  ]
};

const BATCHES = Object.values(BATCH_DEF).flat();

// Fallback dummy data if Firebase is empty
const DUMMY_STUDENTS = [
  { id: '1', studentName: 'Aarav Patel', rollNo: 'A01', parentName: 'Rajesh Patel', contactNo: '9876543210' },
  { id: '2', studentName: 'Diya Sharma', rollNo: 'A02', parentName: 'Sanjay Sharma', contactNo: '9876543211' },
  { id: '3', studentName: 'Rohan Singh', rollNo: 'A03', parentName: 'Vijay Singh', contactNo: '9876543212' },
  { id: '4', studentName: 'Ananya Gupta', rollNo: 'A04', parentName: 'Amit Gupta', contactNo: '9876543213' },
  { id: '5', studentName: 'Aryan Kumar', rollNo: 'A05', parentName: 'Sunil Kumar', contactNo: '9876543214' },
  { id: '6', studentName: 'Ishaan Verma', rollNo: 'A06', parentName: 'Praveen Verma', contactNo: '9876543215' },
  { id: '7', studentName: 'Kavya Joshi', rollNo: 'A07', parentName: 'Ramesh Joshi', contactNo: '9876543216' },
  { id: '8', studentName: 'Neha Desai', rollNo: 'A08', parentName: 'Anil Desai', contactNo: '9876543217' }
];

export default function AttendanceGrid() {
  const [activeTab, setActiveTab] = useState('marking'); // 'marking' or 'followup'
  const [selectedBatch, setSelectedBatch] = useState(BATCHES[0]); // Default first batch
  const [sessionType, setSessionType] = useState('Regular'); // 'Regular', 'Self-Study', 'Sunday Extra'
  const [students, setStudents] = useState([]);
  const [absentees, setAbsentees] = useState(new Set());
  const [inOutTimes, setInOutTimes] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isAlreadyMarked, setIsAlreadyMarked] = useState(false);
  const [existingAttendanceId, setExistingAttendanceId] = useState(null);

  // Follow-up States
  const [followupDate, setFollowupDate] = useState(new Date().toISOString().split('T')[0]);
  const [followupList, setFollowupList] = useState([]);
  const [localNotes, setLocalNotes] = useState({});
  const [savingNotes, setSavingNotes] = useState(new Set());
  const [loadingFollowups, setLoadingFollowups] = useState(false);

  useEffect(() => {
    if (activeTab === 'marking') {
      fetchStudents();
      checkExistingAttendance();
    } else {
      fetchFollowups();
    }
  }, [selectedBatch, activeTab, followupDate, sessionType]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'students'), 
        where('status', '==', 'admitted'),
        where('batch', '==', selectedBatch)
      );
      const snapshot = await getDocs(q);
      
      let fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // If db is empty, inject dummy data for presentation
      if (fetched.length === 0 && selectedBatch.includes('10th')) {
        // Fallback removed to ensure true empty state when no students exist in a batch
      }
      
      setStudents(fetched);
      setInOutTimes({});
    } catch (err) {
      console.error("Failed to fetch students", err);
      setStudents(DUMMY_STUDENTS); // Fallback
    }
    setLoading(false);
  };

  const checkExistingAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const q = query(
        collection(db, 'attendance'),
        where('batch', '==', selectedBatch),
        where('sessionType', '==', sessionType),
        where('date', '==', today)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        setIsAlreadyMarked(true);
        setExistingAttendanceId(docSnap.id);
        const data = docSnap.data();
        setAbsentees(new Set(data.absenteeIds || []));
        if (data.inOutTimes) setInOutTimes(data.inOutTimes);
      } else {
        setIsAlreadyMarked(false);
        setExistingAttendanceId(null);
        setAbsentees(new Set());
      }
    } catch (err) {
      console.error("Failed to check existing attendance", err);
    }
  };

  const fetchFollowups = async () => {
    setLoadingFollowups(true);
    try {
      // 1. Fetch attendance records for followupDate
      const attQuery = query(collection(db, 'attendance'), where('date', '==', followupDate));
      const attSnap = await getDocs(attQuery);
      const attendanceRecords = attSnap.docs.map(doc => doc.data());
      
      // 2. Gather all absentee student IDs and their corresponding batch
      const absenteeMap = {}; // studentId -> batch
      attendanceRecords.forEach(rec => {
        if (rec.absenteeIds && Array.isArray(rec.absenteeIds)) {
          rec.absenteeIds.forEach(id => {
            absenteeMap[id] = rec.batch;
          });
        }
      });

      const uniqueIds = Object.keys(absenteeMap);

      if (uniqueIds.length === 0) {
        setFollowupList([]);
        setLoadingFollowups(false);
        return;
      }

      // 3. Fetch all students to match details
      const stuSnap = await getDocs(query(collection(db, 'students')));
      const allStudents = stuSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Merge in DUMMY_STUDENTS to handle fallback cases
      const studentsById = {};
      DUMMY_STUDENTS.forEach(s => { studentsById[s.id] = s; });
      allStudents.forEach(s => { studentsById[s.id] = s; });

      // 4. Fetch existing follow-up notes for today
      const notesQuery = query(collection(db, 'absentee_followups'), where('date', '==', followupDate));
      const notesSnap = await getDocs(notesQuery);
      const notesMap = {};
      notesSnap.docs.forEach(doc => {
        const data = doc.data();
        notesMap[data.studentId] = data.reason || '';
      });

      // 5. Construct final follow-up list
      const list = uniqueIds.map(id => {
        const info = studentsById[id] || { studentName: 'Unknown Student', contactNo: 'N/A' };
        return {
          id,
          studentName: info.studentName,
          parentName: info.parentName || 'N/A',
          parentContact: info.parentContact || info.contactNo || 'N/A',
          batch: absenteeMap[id],
          note: notesMap[id] || ''
        };
      });

      setFollowupList(list);
      
      // Initialize local note fields
      const initialNotes = {};
      list.forEach(item => {
        initialNotes[item.id] = item.note;
      });
      setLocalNotes(initialNotes);

    } catch (err) {
      console.error("Failed to fetch follow-ups", err);
    }
    setLoadingFollowups(false);
  };

  const handleSaveFollowup = async (studentId, studentName, batch) => {
    const note = localNotes[studentId] || '';
    setSavingNotes(prev => {
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });

    try {
      const docId = `${studentId}_${followupDate}`;
      await setDoc(doc(db, 'absentee_followups', docId), {
        studentId,
        studentName,
        batch,
        date: followupDate,
        reason: note,
        timestamp: serverTimestamp()
      });
      
      // Update list state
      setFollowupList(prev => prev.map(item => item.id === studentId ? { ...item, note } : item));
      alert(`Follow-up note for ${studentName} saved successfully!`);
    } catch (err) {
      console.error("Error saving note", err);
      alert("Failed to save note.");
    } finally {
      setSavingNotes(prev => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });
    }
  };

  const toggleAttendance = (studentId) => {
    setAbsentees(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const attendanceData = {
        batch: selectedBatch,
        sessionType: sessionType,
        date: today,
        totalStudents: students.length,
        absentCount: absentees.size,
        absenteeIds: Array.from(absentees),
        inOutTimes: sessionType !== 'Regular' ? inOutTimes : null,
        timestamp: serverTimestamp()
      };

      if (existingAttendanceId) {
        // Update existing record to prevent duplicates
        await setDoc(doc(db, 'attendance', existingAttendanceId), attendanceData, { merge: true });
      } else {
        // Create new record with predictable ID
        const docId = `${selectedBatch.replace(/[^a-zA-Z0-9]/g, '_')}_${sessionType.replace(/ /g, '_')}_${today}`;
        await setDoc(doc(db, 'attendance', docId), attendanceData);
        setExistingAttendanceId(docId);
      }
      
      setIsAlreadyMarked(true);

      // Show success modal
      setShowSuccess(true);
      
      // Reset after 3 seconds
      setTimeout(() => {
        setShowSuccess(false);
        setAbsentees(new Set());
      }, 3000);

    } catch (err) {
      console.error("Error submitting attendance", err);
      alert("Failed to submit attendance.");
    }
  };

  return (
    <div className="attendance-container">
      <div className="attendance-tabs">
        <button 
          className={`tab-btn ${activeTab === 'marking' ? 'active' : ''}`}
          onClick={() => setActiveTab('marking')}
        >
          <span className="material-symbols-outlined">how_to_reg</span>
          Mark Attendance
        </button>
        <button 
          className={`tab-btn ${activeTab === 'followup' ? 'active' : ''}`}
          onClick={() => setActiveTab('followup')}
        >
          <span className="material-symbols-outlined">call</span>
          Absentee Follow-up
        </button>
      </div>

      {activeTab === 'marking' ? (
        <>
          <div className="attendance-header">
            <div className="attendance-header-text">
              <h1>Daily Attendance Grid</h1>
              <p>1-Tap Absent Marking for Shruti Mam</p>
            </div>
            
            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="batch-selector">
                <label>Select Session Type:</label>
                <select 
                  value={sessionType} 
                  onChange={(e) => { setSessionType(e.target.value); setAbsentees(new Set()); setInOutTimes({}); }}
                >
                  <option value="Regular">Regular Lecture</option>
                  <option value="Self-Study">Self-Study</option>
                  <option value="Sunday Extra">Sunday Extra</option>
                </select>
              </div>
              <div className="batch-selector">
                <label>Select Batch:</label>
                <select 
                  value={selectedBatch} 
                  onChange={(e) => setSelectedBatch(e.target.value)}
                >
                  {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="attendance-actions">
            <div className="attendance-stats">
              <div className="stat-item">
                <span className="stat-value">{students.length}</span>
                <span className="stat-label">Total Strength</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{students.length - absentees.size}</span>
                <span className="stat-label">Present</span>
              </div>
              <div className="stat-item">
                <span className="stat-value absent">{absentees.size}</span>
                <span className="stat-label">Absent</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn-ghost" onClick={() => setAbsentees(new Set())} style={{ height: '44px', padding: '0 24px', borderRadius: '8px', fontWeight: 600, border: '1px solid var(--surface-border)', background: 'var(--surface-bg)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>done_all</span>
                  Mark All Present
                </button>
                <button className="btn-submit" onClick={handleSubmit}>
                  <span className="material-symbols-outlined">{isAlreadyMarked ? 'update' : 'how_to_reg'}</span>
                  {isAlreadyMarked ? 'Update Attendance' : 'Submit Attendance'}
                </button>
              </div>
              {isAlreadyMarked && (
                <div style={{ color: 'var(--status-success)', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                  Attendance already marked for today
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <p>Loading students...</p>
          ) : (
            <div className="student-grid">
              {students.map(student => {
                const isAbsent = absentees.has(student.id);
                return (
                  <div 
                    key={student.id} 
                    className={`student-card ${isAbsent && sessionType === 'Regular' ? 'absent' : ''}`}
                    onClick={() => { if (sessionType === 'Regular') toggleAttendance(student.id); }}
                    style={{ height: sessionType === 'Regular' ? 'auto' : '180px' }}
                  >
                    {isAbsent && sessionType === 'Regular' && <span className="absent-badge">Absent</span>}
                    <div className="student-avatar" style={{ overflow: 'hidden' }}>
                      {student.photoDataUrl ? (
                        <img src={student.photoDataUrl} alt={student.studentName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        (student.studentName || 'S')[0].toUpperCase()
                      )}
                    </div>
                    <h3 className="student-name">{student.studentName || 'Unknown Student'}</h3>
                    
                    {sessionType !== 'Regular' && (
                      <div className="in-out-inputs" onClick={(e) => e.stopPropagation()} style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <label style={{ fontSize: '11px', width: '30px' }}>In:</label>
                          <input 
                            type="time" 
                            className="portal-input" 
                            style={{ padding: '4px', flex: 1 }}
                            value={inOutTimes[student.id]?.in || ''}
                            onChange={e => setInOutTimes({ ...inOutTimes, [student.id]: { ...inOutTimes[student.id], in: e.target.value } })}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <label style={{ fontSize: '11px', width: '30px' }}>Out:</label>
                          <input 
                            type="time" 
                            className="portal-input" 
                            style={{ padding: '4px', flex: 1 }}
                            value={inOutTimes[student.id]?.out || ''}
                            onChange={e => setInOutTimes({ ...inOutTimes, [student.id]: { ...inOutTimes[student.id], out: e.target.value } })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="attendance-header">
            <div className="attendance-header-text">
              <h1>Absentee Follow-up Logs</h1>
              <p>Call parents of absentees and track their response reasons</p>
            </div>
            
            <div className="batch-selector">
              <label>Follow-up Date:</label>
              <input 
                type="date"
                value={followupDate}
                onChange={(e) => setFollowupDate(e.target.value)}
                className="portal-input"
                style={{ width: 'auto', display: 'inline-block' }}
              />
            </div>
          </div>

          {loadingFollowups ? (
            <p>Loading follow-ups...</p>
          ) : followupList.length === 0 ? (
            <div className="empty-state">
              <span className="material-symbols-outlined">check_circle</span>
              <p>No absentees logged for {followupDate}. Everyone was present!</p>
            </div>
          ) : (
            <div className="followup-list">
              {followupList.map(item => (
                <div key={item.id} className="followup-card">
                  <div className="followup-card-header">
                    <div className="followup-student-info">
                      <h3>{item.studentName}</h3>
                      <span className="badge badge-error">{item.batch}</span>
                    </div>
                    <div className="followup-parent-info">
                      <div><strong>Parent:</strong> {item.parentName}</div>
                      <div className="contact-link-container">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>call</span>
                        <a href={`tel:${item.parentContact}`} className="contact-link">{item.parentContact}</a>
                      </div>
                    </div>
                  </div>
                  <div className="followup-card-body">
                    <textarea
                      placeholder="Enter call outcome (e.g., Student has mild fever, will return on Monday)"
                      value={localNotes[item.id] || ''}
                      onChange={(e) => setLocalNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="portal-input followup-textarea"
                    />
                    <div style={{ textAlign: 'right', marginTop: '12px' }}>
                      <button 
                        className="btn btn-brand btn-sm"
                        onClick={() => handleSaveFollowup(item.id, item.studentName, item.batch)}
                        disabled={savingNotes.has(item.id)}
                      >
                        {savingNotes.has(item.id) ? 'Saving...' : 'Save Notes'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Success Modal Overlay */}
      {showSuccess && (
        <div className="success-overlay">
          <div className="success-modal">
            <div className="success-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 48 }}>check_circle</span>
            </div>
            <h2>Attendance Submitted!</h2>
            <p>
              {absentees.size} absentees logged for <strong>{selectedBatch}</strong>.<br/>
              An automatic follow-up list has been generated for Vaishali Mam to start calling parents.
            </p>
            <button className="btn-close" onClick={() => setShowSuccess(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
