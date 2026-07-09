import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDocs, doc, setDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { BATCH_DEF } from './Batches';
import './Faculty.css';
import DayRangeDialer from '../components/DayRangeDialer';

const DEFAULT_SYLLABUS = [
  { batch: '10th Alpha', subject: 'Mathematics', teacher: 'Brijesh Prajapati', progress: 45, lastChapter: 'Quadratic Equations' },
  { batch: '10th Alpha', subject: 'Science', teacher: 'Sneha More', progress: 60, lastChapter: 'Carbon & its Compounds' },
  { batch: '10th Bravo', subject: 'SST & English', teacher: 'Mayur Randive', progress: 30, lastChapter: 'Rise of Nationalism in Europe' },
  { batch: '9th Alpha', subject: 'Hindi & Marathi', teacher: 'Asawari Cherphale', progress: 50, lastChapter: 'Marathi Grammar Sheets' },
  { batch: '9th Alpha', subject: 'Mathematics', teacher: 'Brijesh Prajapati', progress: 40, lastChapter: 'Polynomials' }
];

// Faculty Management Modals and components will go here

function CreateTeacherModal({ onClose }) {
  const [form, setForm] = useState({ fullName: '', email: '', mobile: '', subjects: '', password: '', isSenior: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.email.trim() || !form.fullName.trim() || !form.tempPassword?.trim() || !form.subjects.trim()) {
      setError('Name, Email, Subjects, and Password are required.');
      return;
    }
    setSaving(true);
    setError('');
    
    try {
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), password: form.tempPassword, returnSecureToken: true })
      });
      const authData = await authRes.json();
      if (!authRes.ok || authData.error) throw new Error(authData.error?.message || 'Failed to create teacher account');

      const newUid = authData.localId;
      await setDoc(doc(db, 'users', newUid), {
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        mobile: form.mobile.trim(),
        subjects: form.subjects.trim(),
        isSenior: form.isSenior,
        assignedBatches: [],
        role: 'teacher',
        portalGenerated: true,
        portalPassword: form.tempPassword,
        createdAt: serverTimestamp(),
      });

      // Send Email via Webhook
      try {
        const appScriptUrl = import.meta.env.VITE_APP_SCRIPT_URL;
        if (appScriptUrl) {
          const emailBody = `Dear ${form.fullName},\n\nYour Faculty Portal has been generated.\n\nPortal Link: https://portal.shishyakul.in/login\nLogin Email: ${form.email}\nTemporary Password: ${form.tempPassword}\n\nRegards,\nShishyakul Administration`;
          await fetch(appScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'send_dynamic_email',
              to: form.email,
              subject: 'Shishyakul Faculty Portal Access',
              body: emailBody
            })
          });
          alert("Teacher Portal created successfully and welcome email dispatched!");
        } else {
          alert("Teacher Portal created successfully! (Note: Welcome email skipped because VITE_APP_SCRIPT_URL is missing in .env)");
        }
      } catch (e) {
        console.error("Email error:", e);
        alert("Teacher Portal created, but failed to dispatch welcome email.");
      }

      onClose();
    } catch (e) {
      let msg = e.message;
      if (msg.includes('EMAIL_EXISTS')) msg = 'This email address is already in use.';
      if (msg.includes('WEAK_PASSWORD')) msg = 'Password should be at least 6 characters.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        <h2 className="modal-title">Create Teacher Portal</h2>
        {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
        <div className="form-group"><label className="form-label">Full Name *</label><input className="portal-input" value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Email Address *</label><input className="portal-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
        <div className="form-group">
          <label className="form-label">Temporary Password *</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="portal-input" value={form.tempPassword} onChange={e => setForm(f => ({ ...f, tempPassword: e.target.value }))} style={{ flex: 1 }} />
            <button type="button" className="btn btn-ghost" style={{ padding: '0 12px' }} onClick={() => {
              const randomPass = Math.random().toString(36).slice(-8);
              setForm(f => ({ ...f, tempPassword: randomPass }));
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>autorenew</span>
            </button>
          </div>
        </div>
        <div className="form-group"><label className="form-label">Subjects Taught *</label><input className="portal-input" placeholder="e.g. Science, Maths" value={form.subjects} onChange={e => setForm(f => ({ ...f, subjects: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Mobile</label><input className="portal-input" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Seniority</label><select className="portal-select" value={form.isSenior} onChange={e => setForm(f => ({ ...f, isSenior: e.target.value === 'true' }))}><option value="true">Senior</option><option value="false">Junior</option></select></div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-brand" onClick={handleSave} disabled={saving}>{saving ? 'Generating...' : 'Generate Portal'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Faculty() {
  const [activeTeachers, setActiveTeachers] = useState([]);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [manageBatchesTeacher, setManageBatchesTeacher] = useState(null);
  const [expandedCards, setExpandedCards] = useState({});

  const toggleCard = (e, id) => {
    e.stopPropagation();
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Faculty Profile Detail Modal State
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [isEditingFaculty, setIsEditingFaculty] = useState(false);
  const [facultyEditForm, setFacultyEditForm] = useState({});
  const [availableBatches, setAvailableBatches] = useState([]);
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
    teacherId: '',
    request: '',
    priority: 'Medium'
  });

  // Demo Schedule states
  const [newDemo, setNewDemo] = useState({
    studentName: '',
    subject: 'Mathematics',
    teacherId: '',
    date: ''
  });

  // Parent Feedback CRM states
  const [newFeedback, setNewFeedback] = useState({
    studentId: '',
    teacherId: '',
    rating: 'Satisfied', // 'Satisfied' or 'Complaint'
    notes: ''
  });

  // Timetable Maker State
  const CLASSROOMS = ['SAPTARISHI', 'MEGH SINGH', 'TANAJI KAKSH', 'AHOM KAKSH', 'MANIKARNIKA 1', 'MANIKARNIKA 2'];
  const SLOTS = ['02:00 PM TO 04:00 PM', '04:30 PM TO 06:30 PM', '07:00 PM TO 09:00 PM'];
  const [timetableData, setTimetableData] = useState({});
  const [timetableHeaderDate, setTimetableHeaderDate] = useState('CURRENT TO NEXT');
  const [publishingTimetable, setPublishingTimetable] = useState(false);
  const [timetableSettings, setTimetableSettings] = useState({
    subjects: ['Mathematics', 'Science', 'SST', 'English', 'Hindi', 'Marathi', 'Sanskrit'],
    chapters: {}
  });

  useEffect(() => {
    // 0. Listen to Active Teachers
    const qTeachers = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubTeachers = onSnapshot(qTeachers, (snapshot) => {
      setActiveTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // --- Timetable Data Sync ---
    const qTimetable = query(doc(db, 'timetables', 'master'));
    const unsubTimetable = onSnapshot(qTimetable, (docSnap) => {
      if(docSnap.exists()) {
        const data = docSnap.data();
        setTimetableData(data.schedule || {});
        setTimetableHeaderDate(data.headerDate || 'CURRENT TO NEXT');
      } else {
        setTimetableData({});
      }
    });

    // --- Timetable Settings Sync ---
    const qSettings = query(doc(db, 'timetable_settings', 'defaults'));
    const unsubSettings = onSnapshot(qSettings, async (docSnap) => {
      if(docSnap.exists()) {
        setTimetableSettings(docSnap.data());
      } else {
        const defaultSettings = {
          subjects: ['Mathematics', 'Science', 'SST', 'English', 'Hindi', 'Marathi', 'Sanskrit'],
          chapters: {}
        };
        await setDoc(doc(db, 'timetable_settings', 'defaults'), defaultSettings);
        setTimetableSettings(defaultSettings);
      }
    });

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
      if (data.length > 0) {
        setNewDemo(prev => ({ ...prev, teacherId: prev.teacherId || activeTeachers[0]?.id }));
        setNewFeedback(prev => ({ ...prev, teacherId: prev.teacherId || activeTeachers[0]?.id }));
        setNewGrievance(prev => ({ ...prev, teacherId: prev.teacherId || activeTeachers[0]?.id }));
      }
    });

    // 5. Listen to Parent Feedbacks
    const qFeed = query(collection(db, 'parent_feedbacks'));
    const unsubFeed = onSnapshot(qFeed, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setParentFeedbacks(sorted);
    });

    // 6. Set available batches statically from BATCH_DEF
    const computeBatches = () => {
      const batches = Object.values(BATCH_DEF).flat().map(b => b.id);
      setAvailableBatches(batches);
    };
    computeBatches();

    return () => {
      unsubTeachers();
      unsubTimetable();
      unsubSettings();
      unsubSyl();
      unsubGriev();
      unsubDemo();
      unsubStu();
      unsubFeed();
    };
  }, []);

  const handleUpdateTeacherBatches = async (teacherId, newBatches) => {
    try {
      await updateDoc(doc(db, 'users', teacherId), { assignedBatches: newBatches });
    } catch (err) {
      console.error(err);
      alert('Failed to update assigned batches.');
    }
  };

  const handleAddSubject = async () => {
    const newSub = prompt("Enter new subject name:");
    if (newSub && newSub.trim()) {
      const updated = [...(timetableSettings.subjects || []), newSub.trim()];
      await updateDoc(doc(db, 'timetable_settings', 'defaults'), { subjects: updated });
    }
  };

  const handleAddChapter = async (subject) => {
    if (!subject) return alert("Please select a subject first!");
    const newChap = prompt(`Enter new chapter for ${subject}:`);
    if (newChap && newChap.trim()) {
      const updatedChaps = { ...(timetableSettings.chapters || {}) };
      if (!updatedChaps[subject]) updatedChaps[subject] = [];
      updatedChaps[subject] = [...updatedChaps[subject], newChap.trim()];
      await updateDoc(doc(db, 'timetable_settings', 'defaults'), { chapters: updatedChaps });
    }
  };

  const handleEditChapter = async (subject, oldChap) => {
    if (!subject || !oldChap) return alert("Select a chapter to edit.");
    const newChap = prompt(`Rename chapter "${oldChap}" to:`, oldChap);
    if (newChap && newChap.trim() && newChap !== oldChap) {
      const updatedChaps = { ...(timetableSettings.chapters || {}) };
      updatedChaps[subject] = updatedChaps[subject].map(c => c === oldChap ? newChap.trim() : c);
      await updateDoc(doc(db, 'timetable_settings', 'defaults'), { chapters: updatedChaps });
    }
  };

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
      const targetTeacher = activeTeachers.find(t => t.id === newGrievance.teacherId);
      await addDoc(collection(db, 'faculty_grievances'), {
        teacherId: newGrievance.teacherId,
        teacherName: targetTeacher ? targetTeacher.fullName : 'Unknown',
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
      const targetTeacher = activeTeachers.find(t => t.id === newDemo.teacherId);
      await addDoc(collection(db, 'demo_lectures'), {
        studentName: newDemo.studentName.trim(),
        subject: newDemo.subject,
        teacherId: newDemo.teacherId,
        teacherName: targetTeacher ? targetTeacher.fullName : 'Unknown',
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

  const handleUpdateCell = (slot, classroom, field, value, subField = null) => {
    setTimetableData(prev => {
      const slotData = prev[slot] || {};
      const cellData = slotData[classroom] || { batch: '', monWed: { subject: '', topic: '', teacherId: '' }, thursSat: { subject: '', topic: '', teacherId: '' }, test: { topic: '' } };

      let newCellData = { ...cellData };
      if (subField) {
        newCellData[field] = { ...newCellData[field], [subField]: value };
        
        // Auto-populate subject if teacher is selected
        if (subField === 'teacherId') {
          const teacher = activeTeachers.find(t => t.id === value);
          if (teacher) {
            newCellData[field].subject = teacher.subjects;
          }
        }
      } else {
        newCellData[field] = value;
      }

      return {
        ...prev,
        [slot]: {
          ...slotData,
          [classroom]: newCellData
        }
      };
    });
  };

  const handlePublishTimetable = async () => {
    setPublishingTimetable(true);
    try {
      await setDoc(doc(db, 'timetables', 'master'), {
        schedule: timetableData,
        headerDate: timetableHeaderDate,
        updatedAt: serverTimestamp()
      });
      alert(`Master Timetable published successfully to all dashboards!`);
    } catch(err) {
      alert("Failed to publish timetable: " + err.message);
    }
    setPublishingTimetable(false);
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
    const { studentId, teacherId, rating, notes } = newFeedback;
    if (!studentId || !teacherId || !notes.trim()) return alert('Select student, teacher and write call notes!');

    const targetStudent = students.find(s => s.id === studentId);
    const studentName = targetStudent ? targetStudent.studentName : 'Unknown Student';
    const targetTeacher = activeTeachers.find(t => t.id === teacherId);
    const teacherName = targetTeacher ? targetTeacher.fullName : 'Unknown Faculty';

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
  const selectedTeacher = activeTeachers.find(t => t.id === newDemo.teacherId);
  const isSelectedTeacherSenior = selectedTeacher ? selectedTeacher.isSenior : true;

  return (
    <div className="faculty-container">
      {showTeacherModal && <CreateTeacherModal onClose={() => setShowTeacherModal(false)} />}
      <div className="faculty-header-block" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Faculty Coordinator Hub</h1>
          <p>Logged in as Rohan Sir (Service Manager) • Manage teacher schedules, demo audits, and evaluate calling feedback logs.</p>
        </div>
        <button className="btn btn-brand" onClick={() => setShowTeacherModal(true)}>
          <span className="material-symbols-outlined">person_add</span> Create Teacher Portal
        </button>
      </div>

      {/* Grid: Teachers Cards */}
      <h2 className="section-header-title">Active Faculty Members</h2>
      <div className="faculty-cards-grid">
        {activeTeachers.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No teachers created yet. Click "Create Teacher Portal" to add faculty.</p>
        ) : activeTeachers.map(teacher => (
          <div key={teacher.id} className={`portal-card teacher-profile-card ${teacher.isSenior ? 'senior' : 'junior'}`} onClick={() => {
            setSelectedFaculty(teacher);
            setIsEditingFaculty(false);
          }} style={{ cursor: 'pointer' }}>
            {/* Restructured Card Layout */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div className="teacher-avatar-circle" style={{ flexShrink: 0 }}>{(teacher.fullName?.[0] || 'T').toUpperCase()}</div>
              <div className="teacher-info-block" style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{teacher.fullName}</h3>
                  <span className={`badge-seniority ${teacher.isSenior ? 'senior' : 'junior'}`}>
                    {teacher.isSenior ? 'Senior' : 'Junior'}
                  </span>
                </div>
                <p className="subjects" style={{ margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{teacher.subjects}</p>
                <p className="email" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{teacher.email}</p>
              </div>
              <button 
                className="btn-ghost btn-sm" 
                onClick={(e) => toggleCard(e, teacher.id)} 
                style={{ padding: '4px', alignSelf: 'flex-start', flexShrink: 0, marginTop: '-4px', marginRight: '-4px', borderRadius: '50%' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '24px', color: 'var(--text-secondary)' }}>
                  {expandedCards[teacher.id] ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                </span>
              </button>
            </div>

            {/* Batches Wrapper */}
            {expandedCards[teacher.id] && (
              <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(teacher.assignedBatches || []).length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--status-error)' }}>No batches assigned</span>
              ) : (
                teacher.assignedBatches.map(b => {
                  const progressData = syllabusList.find(s => s.teacherId === teacher.id && s.batch === b);
                  const progressVal = progressData ? progressData.progress : 0;
                  const logVal = progressData?.lastChapter ? progressData.lastChapter : 'No log yet';
                  return (
                    <div key={b} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--surface-base)', padding: '8px 12px', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge badge-branch-manager" style={{ fontSize: '10px', padding: '2px 6px' }}>{b.toUpperCase()}</span>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--brand-primary)' }}>{progressVal}%</span>
                      </div>
                      <div style={{ width: '100%', height: '4px', background: '#ddd', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressVal}%`, height: '100%', background: 'var(--brand-primary)' }}></div>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Log: {logVal}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            )}

            {/* Actions Footer */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px', borderTop: '1px solid var(--surface-border)', paddingTop: '16px' }} onClick={e => e.stopPropagation()}>
              <button className="btn-ghost btn-sm" onClick={() => setManageBatchesTeacher(teacher)} style={{ flex: 1, justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit_square</span> Manage Batches
              </button>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', background: 'var(--surface-bg)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--surface-border)', fontSize: '11px', alignSelf: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--status-success)', fontWeight: 600 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span> Active
                </div>
                <div><strong>Pass:</strong> {teacher.portalPassword || 'Hidden'}</div>
              </div>
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
                  value={newFeedback.teacherId}
                  onChange={e => setNewFeedback({ ...newFeedback, teacherId: e.target.value })}
                  className="portal-select"
                  required
                >
                  <option value="">-- Select Teacher --</option>
                  {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
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
                  value={newDemo.teacherId}
                  onChange={e => setNewDemo({ ...newDemo, teacherId: e.target.value })}
                  className="portal-select"
                  required
                >
                  <option value="">-- Select Teacher --</option>
                  {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
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

      {/* Timetable Maker Section */}
      <div className="portal-card" style={{ marginTop: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>📅 Master Weekly Timetable</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Manage all simultaneous batches and lectures for the entire center.</p>
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="portal-table" style={{ minWidth: '1400px', borderCollapse: 'collapse', border: '2px solid #ccc' }}>
            <thead>
              <tr style={{ background: '#FFEB3B', color: '#000' }}>
                <th colSpan={7} style={{ textAlign: 'center', fontSize: '20px', padding: '12px', border: '1px solid #ccc' }}>
                  SHISHYAKUL TIME TABLE FROM 
                  <input 
                    value={timetableHeaderDate} 
                    onChange={e => setTimetableHeaderDate(e.target.value)} 
                    style={{ background: 'transparent', border: 'none', borderBottom: '2px solid #000', outline: 'none', fontSize: '20px', fontWeight: 'bold', color: '#000', marginLeft: '12px', textAlign: 'center', width: '300px' }} 
                    placeholder="e.g. 08.06.26 TO 14.06.26" 
                  />
                </th>
              </tr>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ width: '80px', border: '1px solid #ccc', textAlign: 'center' }}>T.</th>
                {CLASSROOMS.map(room => (
                  <th key={room} style={{ border: '1px solid #ccc', textAlign: 'center', fontSize: '13px' }}>{room}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map(slot => (
                <React.Fragment key={slot}>
                  {/* Class / Batch Row */}
                  <tr>
                    <td rowSpan={4} style={{ border: '1px solid #ccc', textAlign: 'center', fontWeight: 'bold', width: '80px', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', padding: '12px 0' }}>
                      {slot}
                    </td>
                    {CLASSROOMS.map(room => {
                      const cell = (timetableData[slot]?.[room]) || {};
                      return (
                        <td key={`${slot}-${room}-class`} style={{ border: '1px solid #ccc', padding: '4px', background: '#FFF9C4', textAlign: 'center' }}>
                          <select 
                            value={cell.batch || ''}
                            onChange={e => handleUpdateCell(slot, room, 'batch', e.target.value)}
                            style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: 'bold', fontSize: '12px', textAlign: 'center', outline: 'none', cursor: 'pointer' }}
                          >
                            <option value="">Select Batch</option>
                            {availableBatches.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                  {/* Mon-Wed Row */}
                  <tr>
                    {CLASSROOMS.map(room => {
                      const cell = (timetableData[slot]?.[room]) || {};
                      const mw = cell.monWed || {};
                      return (
                        <td key={`${slot}-${room}-monwed`} style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center', background: '#fff' }}>
                          <DayRangeDialer 
                            value={cell.monWedLabel} 
                            onChange={val => handleUpdateCell(slot, room, 'monWedLabel', val)}
                          />
                          <select 
                            value={mw.teacherId || ''}
                            onChange={e => handleUpdateCell(slot, room, 'monWed', e.target.value, 'teacherId')}
                            style={{ width: '100%', padding: '2px', fontSize: '11px', marginBottom: '4px', color: '#D32F2F', fontWeight: 'bold', border: '1px solid #eee' }}
                          >
                            <option value="">Select Faculty</option>
                            {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                          </select>
                          <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
                            <select 
                              value={mw.subject || ''}
                              onChange={e => handleUpdateCell(slot, room, 'monWed', e.target.value, 'subject')}
                              style={{ flex: 1, padding: '2px', fontSize: '11px', color: '#D32F2F', textAlign: 'center', border: '1px solid #eee', outline: 'none' }}
                            >
                              <option value="">Subject</option>
                              {(timetableSettings.subjects || []).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                            </select>
                            <button className="btn-icon" style={{ padding: 0, width: '16px', background: '#eee' }} onClick={handleAddSubject} title="Add New Subject">
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>add</span>
                            </button>
                          </div>

                          <div style={{ display: 'flex', gap: '2px' }}>
                            <select 
                              value={mw.topic || ''}
                              onChange={e => handleUpdateCell(slot, room, 'monWed', e.target.value, 'topic')}
                              style={{ flex: 1, padding: '2px', fontSize: '11px', color: '#D32F2F', textAlign: 'center', border: '1px solid #eee', outline: 'none' }}
                            >
                              <option value="">Chapter / Topic</option>
                              {mw.subject && (timetableSettings.chapters?.[mw.subject] || []).map(chap => <option key={chap} value={chap}>{chap}</option>)}
                            </select>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              <button className="btn-icon" style={{ padding: 0, width: '14px', height: '10px', minHeight: '10px', background: '#eee', lineHeight: '10px' }} onClick={() => handleAddChapter(mw.subject)} title="Add Chapter">
                                <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>add</span>
                              </button>
                              <button className="btn-icon" style={{ padding: 0, width: '14px', height: '10px', minHeight: '10px', background: '#eee', lineHeight: '10px' }} onClick={() => handleEditChapter(mw.subject, mw.topic)} title="Edit Selected Chapter">
                                <span className="material-symbols-outlined" style={{ fontSize: '9px' }}>edit</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {/* Thurs-Sat Row */}
                  <tr>
                    {CLASSROOMS.map(room => {
                      const cell = (timetableData[slot]?.[room]) || {};
                      const ts = cell.thursSat || {};
                      return (
                        <td key={`${slot}-${room}-thurssat`} style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center', background: '#fcfcfc' }}>
                          <DayRangeDialer 
                            value={cell.thursSatLabel} 
                            onChange={val => handleUpdateCell(slot, room, 'thursSatLabel', val)}
                          />
                          <select 
                            value={ts.teacherId || ''}
                            onChange={e => handleUpdateCell(slot, room, 'thursSat', e.target.value, 'teacherId')}
                            style={{ width: '100%', padding: '2px', fontSize: '11px', marginBottom: '4px', color: '#D32F2F', fontWeight: 'bold', border: '1px solid #eee' }}
                          >
                            <option value="">Select Faculty</option>
                            {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                          </select>
                          <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
                            <select 
                              value={ts.subject || ''}
                              onChange={e => handleUpdateCell(slot, room, 'thursSat', e.target.value, 'subject')}
                              style={{ flex: 1, padding: '2px', fontSize: '11px', color: '#D32F2F', textAlign: 'center', border: '1px solid #eee', outline: 'none' }}
                            >
                              <option value="">Subject</option>
                              {(timetableSettings.subjects || []).map(sub => <option key={sub} value={sub}>{sub}</option>)}
                            </select>
                            <button className="btn-icon" style={{ padding: 0, width: '16px', background: '#eee' }} onClick={handleAddSubject} title="Add New Subject">
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>add</span>
                            </button>
                          </div>

                          <div style={{ display: 'flex', gap: '2px' }}>
                            <select 
                              value={ts.topic || ''}
                              onChange={e => handleUpdateCell(slot, room, 'thursSat', e.target.value, 'topic')}
                              style={{ flex: 1, padding: '2px', fontSize: '11px', color: '#D32F2F', textAlign: 'center', border: '1px solid #eee', outline: 'none' }}
                            >
                              <option value="">Chapter / Topic</option>
                              {ts.subject && (timetableSettings.chapters?.[ts.subject] || []).map(chap => <option key={chap} value={chap}>{chap}</option>)}
                            </select>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                              <button className="btn-icon" style={{ padding: 0, width: '14px', height: '10px', minHeight: '10px', background: '#eee', lineHeight: '10px' }} onClick={() => handleAddChapter(ts.subject)} title="Add Chapter">
                                <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>add</span>
                              </button>
                              <button className="btn-icon" style={{ padding: 0, width: '14px', height: '10px', minHeight: '10px', background: '#eee', lineHeight: '10px' }} onClick={() => handleEditChapter(ts.subject, ts.topic)} title="Edit Selected Chapter">
                                <span className="material-symbols-outlined" style={{ fontSize: '9px' }}>edit</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  {/* Test Row */}
                  <tr>
                    {CLASSROOMS.map(room => {
                      const cell = (timetableData[slot]?.[room]) || {};
                      const test = cell.test || {};
                      const extra = cell.extra || {};
                      const showExtra = cell.showExtra || false;

                      return (
                        <td key={`${slot}-${room}-test`} style={{ border: '1px solid #ccc', padding: '4px', textAlign: 'center', background: '#F5F5F5' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                            <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>SATURDAY TEST</div>
                            <button className="btn-icon" style={{ padding: 0, width: '14px', height: '14px', minHeight: '14px', background: '#e0e0e0', color: '#333' }} onClick={() => handleUpdateCell(slot, room, 'showExtra', !showExtra)} title="Add Sunday Extra Lecture">
                              <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>{showExtra || extra.subject ? 'remove' : 'add'}</span>
                            </button>
                          </div>
                          <input 
                            value={test.topic || ''}
                            onChange={e => handleUpdateCell(slot, room, 'test', e.target.value, 'topic')}
                            placeholder="Test Syllabus"
                            style={{ width: '100%', padding: '2px', fontSize: '11px', color: '#1976D2', textAlign: 'center', border: '1px solid #eee', background: '#fff', outline: 'none', marginBottom: '4px' }}
                          />
                          <select 
                            value={test.preparedBy || ''}
                            onChange={e => handleUpdateCell(slot, room, 'test', e.target.value, 'preparedBy')}
                            style={{ width: '100%', padding: '2px', fontSize: '9px', marginBottom: '2px', color: '#1976D2', border: '1px solid #eee' }}
                            title="Question Paper Prepared By"
                          >
                            <option value="">Prepared By</option>
                            {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                          </select>
                          <select 
                            value={test.checkedBy || ''}
                            onChange={e => handleUpdateCell(slot, room, 'test', e.target.value, 'checkedBy')}
                            style={{ width: '100%', padding: '2px', fontSize: '9px', color: '#1976D2', border: '1px solid #eee' }}
                            title="Answer Sheet Checked By"
                          >
                            <option value="">Checked By</option>
                            {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                          </select>
                          
                          {(showExtra || extra.subject || extra.teacherId) && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #ccc', position: 'relative' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#E91E63' }}>SUNDAY EXTRA</div>
                                <button 
                                  className="btn-icon" 
                                  onClick={() => {
                                    handleUpdateCell(slot, room, 'extra', { subject: '', teacherId: '' });
                                    handleUpdateCell(slot, room, 'showExtra', false);
                                  }}
                                  style={{ padding: 0, width: '14px', height: '14px', minHeight: '14px', color: '#E91E63' }}
                                  title="Delete Sunday Extra"
                                >
                                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>delete</span>
                                </button>
                              </div>
                              <select 
                                value={extra.teacherId || ''}
                                onChange={e => handleUpdateCell(slot, room, 'extra', e.target.value, 'teacherId')}
                                style={{ width: '100%', padding: '2px', fontSize: '10px', marginBottom: '4px', color: '#D32F2F', fontWeight: 'bold', border: '1px solid #eee' }}
                              >
                                <option value="">Select Faculty</option>
                                {activeTeachers.map(t => <option key={t.id} value={t.id}>{t.fullName}</option>)}
                              </select>
                              <input 
                                value={extra.subject || ''}
                                onChange={e => handleUpdateCell(slot, room, 'extra', e.target.value, 'subject')}
                                placeholder="Subject"
                                style={{ width: '100%', padding: '2px', fontSize: '10px', marginBottom: '4px', color: '#D32F2F', textAlign: 'center', border: '1px solid #eee' }}
                              />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button className="btn btn-brand" onClick={handlePublishTimetable} disabled={publishingTimetable}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: '6px', fontSize: '18px' }}>publish</span>
            {publishingTimetable ? 'Publishing...' : 'Push Master Timetable to All'}
          </button>
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

      {/* Manage Batches Modal */}
      {manageBatchesTeacher && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setManageBatchesTeacher(null); }}>
          <div className="modal-box">
            <h2 className="modal-title">Manage Batches for {manageBatchesTeacher.fullName}</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Select the batches this teacher is responsible for.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', background: 'var(--surface-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
              {availableBatches.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No batches available in the database.</p>}
              {availableBatches.map(batch => {
                const isAssigned = (manageBatchesTeacher.assignedBatches || []).includes(batch);
                return (
                  <label key={batch} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                    <input 
                      type="checkbox" 
                      checked={isAssigned}
                      onChange={(e) => {
                        let newBatches = [...(manageBatchesTeacher.assignedBatches || [])];
                        if (e.target.checked) {
                          newBatches.push(batch);
                        } else {
                          newBatches = newBatches.filter(b => b !== batch);
                        }
                        setManageBatchesTeacher({ ...manageBatchesTeacher, assignedBatches: newBatches });
                      }}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    {batch}
                  </label>
                );
              })}
            </div>

            <div className="modal-footer" style={{ marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setManageBatchesTeacher(null)}>Cancel</button>
              <button 
                className="btn btn-brand" 
                onClick={() => {
                  handleUpdateTeacherBatches(manageBatchesTeacher.id, manageBatchesTeacher.assignedBatches || []);
                  setManageBatchesTeacher(null);
                }}
              >
                Save Batch Assignments
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Faculty Profile Full Screen Modal */}
      {selectedFaculty && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedFaculty(null); }}>
          <div className="modal-box" style={{ maxWidth: '800px', width: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid var(--surface-border)', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div className="teacher-avatar-circle" style={{ width: '64px', height: '64px', fontSize: '28px' }}>
                  {(selectedFaculty.fullName?.[0] || 'T').toUpperCase()}
                </div>
                <div>
                  <h2 className="modal-title" style={{ margin: 0 }}>{selectedFaculty.fullName}</h2>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>school</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{selectedFaculty.subjects}</span>
                    <span className={`badge-seniority ${selectedFaculty.isSenior ? 'senior' : 'junior'}`} style={{ marginLeft: '8px' }}>
                      {selectedFaculty.isSenior ? 'Senior' : 'Junior'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {!isEditingFaculty ? (
                  <button className="btn btn-ghost" onClick={() => {
                    setFacultyEditForm({
                      fullName: selectedFaculty.fullName,
                      email: selectedFaculty.email,
                      mobile: selectedFaculty.mobile,
                      subjects: selectedFaculty.subjects,
                      isSenior: selectedFaculty.isSenior
                    });
                    setIsEditingFaculty(true);
                  }}>
                    <span className="material-symbols-outlined">edit</span> Edit Profile
                  </button>
                ) : (
                  <button className="btn btn-ghost" onClick={() => setIsEditingFaculty(false)}>
                    <span className="material-symbols-outlined">close</span> Cancel
                  </button>
                )}
                <button className="btn-icon" onClick={() => setSelectedFaculty(null)}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            <div className="modal-body">
              {!isEditingFaculty ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                  {/* View Mode */}
                  <div>
                    <h3 className="section-header-title">Personal Details</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Email ID</div>
                        <div style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{selectedFaculty.email}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Mobile Number</div>
                        <div style={{ fontSize: '15px', color: 'var(--text-primary)' }}>{selectedFaculty.mobile || 'Not Provided'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Role</div>
                        <div style={{ fontSize: '15px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>{selectedFaculty.role}</div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="section-header-title">Academic & Portal</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Assigned Batches</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {(selectedFaculty.assignedBatches || []).length === 0 ? (
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>None assigned</span>
                          ) : (
                            selectedFaculty.assignedBatches.map(b => (
                              <span key={b} className="badge badge-branch-manager" style={{ padding: '4px 10px' }}>{b}</span>
                            ))
                          )}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Portal Status</div>
                        {selectedFaculty.portalGenerated ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--status-success)', fontWeight: 600 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span> Active (Pass: {selectedFaculty.portalPassword || 'Hidden'})
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--status-warning)', fontWeight: 600 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>pending</span> Not Generated
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Edit Mode */}
                  <h3 className="section-header-title">Edit Faculty Details</h3>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input className="portal-input" value={facultyEditForm.fullName} onChange={e => setFacultyEditForm({...facultyEditForm, fullName: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mobile Number</label>
                      <input className="portal-input" value={facultyEditForm.mobile} onChange={e => setFacultyEditForm({...facultyEditForm, mobile: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Subjects Taught</label>
                      <input className="portal-input" value={facultyEditForm.subjects} onChange={e => setFacultyEditForm({...facultyEditForm, subjects: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Seniority</label>
                      <select className="portal-select" value={facultyEditForm.isSenior ? 'true' : 'false'} onChange={e => setFacultyEditForm({...facultyEditForm, isSenior: e.target.value === 'true'})}>
                        <option value="true">Senior Faculty</option>
                        <option value="false">Junior Faculty</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer" style={{ borderTop: '1px solid var(--surface-border)', paddingTop: '16px' }}>
                    <button className="btn btn-brand" onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'users', selectedFaculty.id), {
                          fullName: facultyEditForm.fullName,
                          mobile: facultyEditForm.mobile,
                          subjects: facultyEditForm.subjects,
                          isSenior: facultyEditForm.isSenior
                        });
                        // Update local state to reflect changes instantly without re-fetching entire list
                        setSelectedFaculty({...selectedFaculty, ...facultyEditForm});
                        setIsEditingFaculty(false);
                      } catch (err) {
                        alert("Failed to update profile: " + err.message);
                      }
                    }}>Save Changes</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
