import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getDocs, doc, setDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './Faculty.css';

const ACTIVE_TEACHERS = [
  { name: 'Mayur Randive', subjects: 'SST & English', avatar: 'M', email: 'mayur@shishyakul.in', isSenior: true },
  { name: 'Asawari Cherphale', subjects: 'Hindi & Marathi', avatar: 'A', email: 'asawari@shishyakul.in', isSenior: true },
  { name: 'Sneha More', subjects: 'Science', avatar: 'S', email: 'sneha@shishyakul.in', isSenior: true },
  { name: 'Brijesh Prajapati', subjects: 'Mathematics', avatar: 'B', email: 'brijesh@shishyakul.in', isSenior: true },
  { name: 'Sanjay Sharma (Junior)', subjects: 'General Science', avatar: 'S', email: 'sanjay@shishyakul.in', isSenior: false }
];

const DEFAULT_SYLLABUS = [
  { batch: '10th Alpha', subject: 'Mathematics', teacher: 'Brijesh Prajapati', progress: 45, lastChapter: 'Quadratic Equations' },
  { batch: '10th Alpha', subject: 'Science', teacher: 'Sneha More', progress: 60, lastChapter: 'Carbon & its Compounds' },
  { batch: '10th Bravo', subject: 'SST & English', teacher: 'Mayur Randive', progress: 30, lastChapter: 'Rise of Nationalism in Europe' },
  { batch: '9th Alpha', subject: 'Hindi & Marathi', teacher: 'Asawari Cherphale', progress: 50, lastChapter: 'Marathi Grammar Sheets' },
  { batch: '9th Alpha', subject: 'Mathematics', teacher: 'Brijesh Prajapati', progress: 40, lastChapter: 'Polynomials' }
];

export default function Faculty() {
  const [syllabusList, setSyllabusList] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [demos, setDemos] = useState([]);
  const [parentFeedbacks, setParentFeedbacks] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Syllabus progress update states
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressItemId, setProgressItemId] = useState(null);
  const [newProgressVal, setNewProgressVal] = useState(0);
  const [lastChapterName, setLastChapterName] = useState('');

  // Grievance Form states
  const [newGrievance, setNewGrievance] = useState({
    teacherName: ACTIVE_TEACHERS[0].name,
    request: '',
    priority: 'Medium'
  });

  // Demo Schedule states
  const [newDemo, setNewDemo] = useState({
    studentName: '',
    subject: 'Mathematics',
    teacherName: ACTIVE_TEACHERS[0].name,
    date: ''
  });

  // Parent Feedback CRM states
  const [newFeedback, setNewFeedback] = useState({
    studentId: '',
    teacherName: ACTIVE_TEACHERS[0].name,
    rating: 'Satisfied', // 'Satisfied' or 'Complaint'
    notes: ''
  });

  useEffect(() => {
    // 1. Listen to Syllabus Progress
    const qSyl = query(collection(db, 'syllabus_progress'));
    const unsubSyl = onSnapshot(qSyl, async (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (data.length === 0) {
        setLoading(true);
        for (const s of DEFAULT_SYLLABUS) {
          const docRef = doc(collection(db, 'syllabus_progress'));
          await setDoc(docRef, s);
        }
        setLoading(false);
      } else {
        setSyllabusList(data);
      }
    });

    // 2. Listen to Grievances
    const qGriev = query(collection(db, 'faculty_grievances'));
    const unsubGriev = onSnapshot(qGriev, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setGrievances(sorted);
    });

    // 3. Listen to Demo Lectures
    const qDemo = query(collection(db, 'demo_lectures'));
    const unsubDemo = onSnapshot(qDemo, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setDemos(sorted);
    });

    // 4. Fetch Admitted Students for parent feedbacks
    const qStu = query(collection(db, 'students'));
    const unsubStu = onSnapshot(qStu, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(data);
    });

    // 5. Listen to Parent Feedbacks
    const qFeed = query(collection(db, 'parent_feedbacks'));
    const unsubFeed = onSnapshot(qFeed, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setParentFeedbacks(sorted);
    });

    return () => {
      unsubSyl();
      unsubGriev();
      unsubDemo();
      unsubStu();
      unsubFeed();
    };
  }, []);

  const handleOpenProgress = (item) => {
    setProgressItemId(item.id);
    setNewProgressVal(item.progress);
    setLastChapterName(item.lastChapter || '');
    setShowProgressModal(true);
  };

  const handleProgressSubmit = async () => {
    try {
      await updateDoc(doc(db, 'syllabus_progress', progressItemId), {
        progress: Number(newProgressVal),
        lastChapter: lastChapterName.trim()
      });
      setShowProgressModal(false);
      setProgressItemId(null);
      alert('Syllabus completion progress updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update progress.');
    }
  };

  const handleCreateGrievance = async (e) => {
    e.preventDefault();
    if (!newGrievance.request.trim()) return alert('Please enter grievance details!');

    try {
      await addDoc(collection(db, 'faculty_grievances'), {
        teacherName: newGrievance.teacherName,
        request: newGrievance.request.trim(),
        priority: newGrievance.priority,
        status: 'Pending',
        timestamp: serverTimestamp()
      });
      setNewGrievance(prev => ({ ...prev, request: '' }));
      alert('Grievance logged on Rohan\'s Coordination Board!');
    } catch (err) {
      console.error(err);
      alert('Failed to log grievance.');
    }
  };

  const handleResolveGrievance = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Pending' ? 'Resolved' : 'Pending';
    try {
      await updateDoc(doc(db, 'faculty_grievances', id), {
        status: nextStatus
      });
    } catch (err) {
      console.error(err);
      alert('Failed to toggle status.');
    }
  };

  const handleCreateDemo = async (e) => {
    e.preventDefault();
    if (!newDemo.studentName.trim() || !newDemo.date) return alert('Enter student name and demo date!');

    try {
      await addDoc(collection(db, 'demo_lectures'), {
        studentName: newDemo.studentName.trim(),
        subject: newDemo.subject,
        teacherName: newDemo.teacherName,
        date: newDemo.date,
        status: 'Scheduled',
        timestamp: serverTimestamp()
      });
      setNewDemo(prev => ({ ...prev, studentName: '', date: '' }));
      alert('Demo lecture scheduled successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to schedule demo.');
    }
  };

  const handleToggleDemoStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Scheduled' ? 'Conducted' : 'Scheduled';
    try {
      await updateDoc(doc(db, 'demo_lectures', id), {
        status: nextStatus
      });
    } catch (err) {
      console.error(err);
      alert('Failed to update status.');
    }
  };

  const handleCreateFeedback = async (e) => {
    e.preventDefault();
    const { studentId, teacherName, rating, notes } = newFeedback;
    if (!studentId || !notes.trim()) return alert('Select student and write call notes!');

    const targetStudent = students.find(s => s.id === studentId);
    const studentName = targetStudent ? targetStudent.studentName : 'Unknown Student';

    try {
      await addDoc(collection(db, 'parent_feedbacks'), {
        studentId,
        studentName,
        teacherName,
        rating,
        notes: notes.trim(),
        needsBranchManagerAttention: rating === 'Complaint',
        date: new Date().toLocaleString(),
        timestamp: serverTimestamp()
      });
      
      setNewFeedback(prev => ({ ...prev, studentId: '', notes: '' }));
      alert(`Parent evaluation logged! ${rating === 'Complaint' ? '⚠️ Escaled to Sumit Sir (Branch Manager) Dashboard.' : 'Successfully saved.'}`);
    } catch (err) {
      console.error('Error logging parent feedback', err);
      alert('Failed to save parent feedback.');
    }
  };

  // Check if current demo teacher selection is senior
  const selectedTeacher = ACTIVE_TEACHERS.find(t => t.name === newDemo.teacherName);
  const isSelectedTeacherSenior = selectedTeacher ? selectedTeacher.isSenior : true;

  return (
    <div className="faculty-container">
      <div className="faculty-header-block">
        <div>
          <h1>Faculty Coordinator Hub</h1>
          <p>Logged in as Rohan Sir (Service Manager) • Manage teacher schedules, demo audits, and evaluate calling feedback logs.</p>
        </div>
      </div>

      {/* Grid: Teachers Cards */}
      <h2 className="section-header-title">Active Faculty Members</h2>
      <div className="faculty-cards-grid">
        {ACTIVE_TEACHERS.map(teacher => (
          <div key={teacher.name} className={`portal-card teacher-profile-card ${teacher.isSenior ? 'senior' : 'junior'}`}>
            <div className="teacher-avatar-circle">{teacher.avatar}</div>
            <div className="teacher-info-block">
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <h3>{teacher.name}</h3>
                <span className={`badge-seniority ${teacher.isSenior ? 'senior' : 'junior'}`}>
                  {teacher.isSenior ? 'Senior' : 'Junior'}
                </span>
              </div>
              <p className="subjects">{teacher.subjects}</p>
              <p className="email">{teacher.email}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid: Forms & Action Panels */}
      <div className="faculty-dashboard-grid">
        
        {/* Panel 1: Parent Feedback Evaluation CRM */}
        <div className="portal-card faculty-card-panel">
          <h2>📞 Parent Calling Feedback CRM</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginBottom: '20px' }}>
            Record parent reviews on teacher classes. Complaints escalate directly to Sumit Sir next day.
          </p>
          <form onSubmit={handleCreateFeedback}>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Evaluate Student's Class</label>
                <select 
                  value={newFeedback.studentId}
                  onChange={e => setNewFeedback({ ...newFeedback, studentId: e.target.value })}
                  className="portal-select"
                  required
                >
                  <option value="">-- Select Student --</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.studentName} ({s.standard || 'Admitted'})</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">For Faculty</label>
                <select 
                  value={newFeedback.teacherName}
                  onChange={e => setNewFeedback({ ...newFeedback, teacherName: e.target.value })}
                  className="portal-select"
                >
                  {ACTIVE_TEACHERS.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Evaluation Rating</label>
              <select 
                value={newFeedback.rating}
                onChange={e => setNewFeedback({ ...newFeedback, rating: e.target.value })}
                className="portal-select"
              >
                <option value="Satisfied">Satisfied / Good Feedback</option>
                <option value="Complaint">Complaint (Needs Sumit Sir Escalation)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Parent Call Notes</label>
              <textarea
                rows={2}
                placeholder="Log home feedback details (e.g. Student feels pace is fast in science class)"
                value={newFeedback.notes}
                onChange={e => setNewFeedback({ ...newFeedback, notes: e.target.value })}
                className="portal-input"
                required
              />
            </div>

            <button type="submit" className="btn btn-brand" style={{ width: '100%', marginTop: '8px' }}>
              Save Calling Log
            </button>
          </form>

          {/* Feedback Feed List */}
          <div className="grievance-feed-list" style={{ marginTop: '24px' }}>
            {parentFeedbacks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No parent feedbacks recorded.</p>
            ) : (
              parentFeedbacks.map(f => (
                <div key={f.id} className={`grievance-item-card ${f.rating === 'Complaint' ? 'complaint-escalated' : ''}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong>Student: {f.studentName}</strong>
                    <span className={`status-tag ${f.rating === 'Complaint' ? 'pending' : 'resolved'}`}>
                      {f.rating === 'Complaint' ? '⚠️ COMPLAINT' : 'SATISFIED'}
                    </span>
                  </div>
                  <p><strong>Faculty:</strong> {f.teacherName}</p>
                  <p style={{ marginTop: '4px', fontStyle: 'italic' }}>"{f.notes}"</p>
                  {f.rating === 'Complaint' && (
                    <div className="escalation-alert-label">
                      📢 Escalated to Sumit Sir (Branch Manager) Dashboard
                    </div>
                  )}
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Logged: {f.date}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel 2: Demo Coordinator Schedule */}
        <div className="portal-card faculty-card-panel">
          <h2>📅 Schedule Student Demo Lecture</h2>
          <form onSubmit={handleCreateDemo}>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Student Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Rahul Patil"
                  value={newDemo.studentName}
                  onChange={e => setNewDemo({ ...newDemo, studentName: e.target.value })}
                  className="portal-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Subject</label>
                <select 
                  value={newDemo.subject}
                  onChange={e => setNewDemo({ ...newDemo, subject: e.target.value })}
                  className="portal-select"
                >
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science">Science</option>
                  <option value="English">English</option>
                  <option value="Social Science">Social Science</option>
                </select>
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Assign Teacher</label>
                <select 
                  value={newDemo.teacherName}
                  onChange={e => setNewDemo({ ...newDemo, teacherName: e.target.value })}
                  className="portal-select"
                >
                  {ACTIVE_TEACHERS.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Demo Date & Time</label>
                <input 
                  type="datetime-local"
                  value={newDemo.date}
                  onChange={e => setNewDemo({ ...newDemo, date: e.target.value })}
                  className="portal-input"
                  required
                />
              </div>
            </div>

            {/* Seniority Warning Guard */}
            {!isSelectedTeacherSenior && (
              <div className="teacher-seniority-warning">
                <span className="material-symbols-outlined">warning</span>
                <span>Warning: Demo lectures should ideally be assigned to Senior/Regular faculty only!</span>
              </div>
            )}

            <button type="submit" className="btn btn-brand" style={{ width: '100%', marginTop: '8px' }}>
              Schedule Demo Class
            </button>
          </form>

          {/* Demos List */}
          <div className="demo-schedule-list">
            {demos.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '16px' }}>No demo classes scheduled.</p>
            ) : (
              demos.map(d => (
                <div key={d.id} className="demo-item-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong>Student: {d.studentName}</strong>
                    <span className={`status-tag ${d.status.toLowerCase()}`}>{d.status}</span>
                  </div>
                  <p>Subject: {d.subject} • Faculty: {d.teacherName}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Scheduled: {new Date(d.date).toLocaleString()}
                  </p>
                  
                  <div style={{ textAlign: 'right', marginTop: '10px' }}>
                    <button 
                      className={`btn btn-sm ${d.status === 'Scheduled' ? 'btn-brand' : 'btn-ghost'}`}
                      onClick={() => handleToggleDemoStatus(d.id, d.status)}
                    >
                      {d.status === 'Scheduled' ? 'Mark Conducted' : 'Re-Schedule'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Syllabus Tracking Section */}
      <div className="portal-card syllabus-tracker-card">
        <h2>📚 Academic Syllabus Tracker</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Monitor syllabus completion percentages for batches and subjects.</p>
        
        {loading ? (
          <p>Syncing syllabus tracking progress...</p>
        ) : (
          <div className="syllabus-grid">
            {syllabusList.map(syl => (
              <div key={syl.id} className="syllabus-row-item">
                <div className="syllabus-meta-row">
                  <div>
                    <h3>{syl.batch} - {syl.subject}</h3>
                    <p className="teacher-desc">Faculty: {syl.teacher}</p>
                  </div>
                  <div className="syllabus-progress-amount">{syl.progress}%</div>
                </div>

                <div className="syllabus-progress-bar-bg">
                  <div className="syllabus-progress-bar-fill" style={{ width: `${syl.progress}%` }} />
                </div>

                <div className="syllabus-chapter-row">
                  <span>Last Chapter completed: <strong>{syl.lastChapter || 'None'}</strong></span>
                  <button className="btn-manual-pay btn-sm" onClick={() => handleOpenProgress(syl)}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_note</span>
                    Update Track
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid: Grievance Section (resolved list moved down for clarity) */}
      <div className="portal-card faculty-card-panel" style={{ marginTop: '28px' }}>
        <h2>🛠️ Teacher Grievance Log List</h2>
        <form onSubmit={handleCreateGrievance} style={{ display: 'none' }}></form>
        
        <div className="grievance-feed-list" style={{ maxHeight: 'none' }}>
          {grievances.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No faculty grievances logged.</p>
          ) : (
          <div className="table-responsive">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Priority</th>
                  <th>Request Details</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {grievances.map(g => (
                  <tr key={g.id}>
                    <td><strong>{g.teacherName}</strong></td>
                    <td>
                      <span className={`priority-tag ${g.priority.toLowerCase()}`}>
                        {g.priority}
                      </span>
                    </td>
                    <td>{g.request}</td>
                    <td>
                      <span className={`status-tag ${g.status.toLowerCase()}`}>
                        {g.status}
                      </span>
                    </td>
                    <td>
                      <button 
                        className={`btn btn-sm ${g.status === 'Pending' ? 'btn-brand' : 'btn-ghost'}`}
                        onClick={() => handleResolveGrievance(g.id, g.status)}
                      >
                        {g.status === 'Pending' ? 'Resolve' : 'Re-open'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>

      {/* Progress Modals */}
      {showProgressModal && (
        <div className="fees-modal-overlay">
          <div className="fees-modal">
            <h2>📈 Update Syllabus Progress</h2>
            <p>Update syllabus progress metrics for Rohan and Sumit Sir to review.</p>
            
            <div className="form-group">
              <label className="form-label">Progress Percentage ({newProgressVal}%)</label>
              <input 
                type="range"
                min="0"
                max="100"
                value={newProgressVal} 
                onChange={e => setNewProgressVal(e.target.value)} 
                className="portal-input"
                style={{ height: 'auto', padding: 0 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Latest Completed Chapter Name</label>
              <input 
                type="text" 
                placeholder="e.g. Quadratic Equations" 
                value={lastChapterName} 
                onChange={e => setLastChapterName(e.target.value)} 
                className="portal-input"
                required
              />
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowProgressModal(false);
                  setProgressItemId(null);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-brand" 
                onClick={handleProgressSubmit}
              >
                Update Ledger
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
