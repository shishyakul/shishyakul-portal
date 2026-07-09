import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

export default function TeacherDashboard({ profile }) {
  const { user } = useAuth();
  const teacherId = user?.uid || profile?.id;
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(() => {
    return location.hash.replace('#', '') || 'batches';
  });

  useEffect(() => {
    const hash = location.hash.replace('#', '');
    if (hash && hash !== activeTab) {
      setActiveTab(hash);
    }
  }, [location.hash]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`#${tab}`, { replace: true });
  };
  const [materials, setMaterials] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [students, setStudents] = useState([]);
  const [timetables, setTimetables] = useState([]); // Kept for backward compatibility if needed, but we will use `timetable` object
  const [timetable, setTimetable] = useState({});
  const [timetableHeaderDate, setTimetableHeaderDate] = useState('');
  const [testWorkflows, setTestWorkflows] = useState({});
  const [loading, setLoading] = useState(true);

  // Grading Modal State
  const [gradingModal, setGradingModal] = useState({ isOpen: false, testId: null, batch: '', maxMarks: 0, testDate: '', subject: '', topic: '' });
  const [marksData, setMarksData] = useState({});
  const [draftModal, setDraftModal] = useState({ isOpen: false, duty: null, link: '', startDate: null });

  // Material Form
  const [newMaterial, setNewMaterial] = useState({
    title: '',
    type: 'Notes',
    batch: (profile?.assignedBatches || [])[0] || '',
    driveLink: '',
    description: ''
  });
  // Syllabus Tracking State
  const [syllabusData, setSyllabusData] = useState([]);
  const [syllabusUpdates, setSyllabusUpdates] = useState({});
  const [syllabusLogs, setSyllabusLogs] = useState({});
  const [facultyMap, setFacultyMap] = useState({});

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const map = {};
      snap.forEach(d => { map[d.id] = d.data().fullName || d.data().email || 'Unknown Teacher'; });
      setFacultyMap(map);
    });

    // 1. Listen to Course Materials (only if assigned batches exist)
    let unsubMat = () => {};
    if (profile?.assignedBatches?.length > 0) {
      const qMat = query(collection(db, 'course_materials'), where('batch', 'in', profile.assignedBatches));
      unsubMat = onSnapshot(qMat, (snap) => {
        setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp));
      });
    }

    // 2. Listen to Submissions (only if assigned batches exist)
    let unsubSub = () => {};
    if (profile?.assignedBatches?.length > 0) {
      const qSub = query(collection(db, 'submissions'), where('batch', 'in', profile.assignedBatches));
      unsubSub = onSnapshot(qSub, (snap) => {
        setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp));
      });
    }

    // 3. Listen to all Students (teachers may grade batches they don't teach)
    const unsubStu = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 4. Listen to Master Timetable and Workflows
    const unsubTimetable = onSnapshot(doc(db, 'timetables', 'master'), (docSnap) => {
      if(docSnap.exists()) {
        const data = docSnap.data();
        setTimetable(data.schedule || {});
        setTimetableHeaderDate(data.headerDate || '');
      } else {
        setTimetable({});
      }
    });

    const unsubWorkflows = onSnapshot(collection(db, 'test_workflows'), (snapshot) => {
      const w = {};
      snapshot.forEach(d => w[d.id] = d.data());
      setTestWorkflows(w);
    });

    // 5. Listen to Syllabus Progress
    const qSyl = query(collection(db, 'syllabus_progress'), where('teacherId', '==', teacherId));
    const unsubSyl = onSnapshot(qSyl, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSyllabusData(data);
      
      const upds = {};
      const lgs = {};
      data.forEach(d => {
        upds[d.batch] = d.progress;
        lgs[d.batch] = d.lastChapter;
      });
      setSyllabusUpdates(upds);
      setSyllabusLogs(lgs);
    });

    setLoading(false);

    return () => {
      unsubMat();
      unsubSub();
      unsubStu(); 
      unsubTimetable(); 
      unsubSyl(); 
      unsubUsers();
      unsubWorkflows();
    };
  }, [profile?.assignedBatches, teacherId]);

  const handlePostMaterial = async (e) => {
    e.preventDefault();
    if (!newMaterial.title || !newMaterial.driveLink) return alert('Title and Drive Link are required');
    try {
      await addDoc(collection(db, 'course_materials'), {
        ...newMaterial,
        teacherId: profile.uid,
        teacherName: profile.fullName,
        timestamp: serverTimestamp()
      });
      setNewMaterial(p => ({ ...p, title: '', driveLink: '', description: '' }));
      alert('Material posted successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to post material');
    }
  };

  const handleGradeSubmission = async (subId, marks) => {
    try {
      await updateDoc(doc(db, 'submissions', subId), {
        marks: Number(marks),
        graded: true,
        gradedAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      alert('Failed to save grade');
    }
  };


  const handleSaveProgress = async (batch) => {
    const progress = syllabusUpdates[batch] || 0;
    const log = syllabusLogs[batch] || '';
    if (!log.trim()) return alert('Please enter a subject log before saving.');
    
    const docId = `${batch.replace(/[^a-zA-Z0-9]/g, '_')}_${teacherId}`;
    try {
      await setDoc(doc(db, 'syllabus_progress', docId), {
        batch,
        teacherId,
        teacherName: profile.fullName,
        subject: profile.subjects || 'General',
        progress: Number(progress),
        lastChapter: log.trim(),
        timestamp: serverTimestamp()
      });
      alert('Syllabus progress updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update progress.');
    }
  };
  if (loading) return <div className="empty-state"><div className="spinner"/></div>;

  const assignedBatches = profile?.assignedBatches || [];

  const parseStartDate = (text) => {
    if (!text) return new Date();
    const match = text.match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})/);
    if (match) {
      let [_, d, m, y] = match;
      return new Date(y.length === 2 ? 2000 + parseInt(y) : parseInt(y), parseInt(m) - 1, parseInt(d));
    }
    const d = new Date(text);
    if (!isNaN(d.getTime())) return d;
    return new Date();
  };
  const startDate = parseStartDate(timetableHeaderDate);
  const formatDate = (dateObj) => {
    if (!dateObj) return '';
    return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getFullYear().toString().slice(-2)}`;
  };
  const getSaturdayDateStr = () => {
    if (!startDate) return 'UNKNOWN';
    const sat = new Date(startDate);
    sat.setDate(sat.getDate() + 5);
    return formatDate(sat);
  };
  const saturdayDateStr = getSaturdayDateStr();

  // Extract Test Duties Globally (merged per test)
  const allTestDuties = [];
  for (const slot of Object.keys(timetable)) {
    for (const room of Object.keys(timetable[slot] || {})) {
      const cell = timetable[slot][room];
      if (cell?.test) {
        if (cell.test.preparedBy === teacherId || cell.test.checkedBy === teacherId) {
          const testId = `${saturdayDateStr.replace(/\//g, '-')}_${cell.batch}`;
          const workflow = testWorkflows[testId];
          const isPreparer = cell.test.preparedBy === teacherId;
          const isChecker = cell.test.checkedBy === teacherId;
          const prepName = facultyMap[cell.test.preparedBy] || 'Unknown';
          const checkName = facultyMap[cell.test.checkedBy] || 'Unknown';
          
          allTestDuties.push({
            batch: cell.batch,
            topic: cell.test.topic,
            subject: cell.thursSat.subject,
            room,
            testId,
            workflow,
            isPreparer,
            isChecker,
            prepName,
            checkName
          });
        }
      }
    }
  }

  const upcomingTestDuties = allTestDuties.filter(duty => duty.workflow?.status !== 'graded');
  const completedTestDuties = allTestDuties.filter(duty => duty.workflow?.status === 'graded');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Faculty Portal</h1>
          <p className="page-subtitle">Welcome back, {profile?.fullName} • {profile?.subjects || 'Faculty'}</p>
        </div>
      </div>


      {activeTab === 'batches' && (
        <div className="portal-card">
          <h2><span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>groups</span>My Assigned Batches</h2>
          {assignedBatches.length === 0 ? (
            <div className="empty-state">You have no assigned batches yet. Contact the Service Manager.</div>
          ) : (
            <div className="responsive-grid-2" style={{ gap: 16, marginTop: 24 }}>
              {assignedBatches.map(batch => (
                <div key={batch} style={{ padding: 20, background: 'var(--surface-bg)', borderRadius: 12, border: '1px solid var(--surface-border)' }}>
                  <h3 style={{ marginBottom: 12 }}>{batch}</h3>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {students.filter(s => s.batch === batch).length} Students Enrolled
                  </div>
                  
                  <div style={{ marginTop: 16, borderTop: '1px solid var(--surface-border)', paddingTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, alignItems: 'center' }}>
                      <strong>Syllabus Progress</strong>
                      <span style={{ color: 'var(--brand-primary)', fontWeight: 'bold', fontSize: 16 }}>{syllabusUpdates[batch] || 0}%</span>
                    </div>
                    
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={syllabusUpdates[batch] || 0}
                      onChange={(e) => setSyllabusUpdates(prev => ({ ...prev, [batch]: e.target.value }))}
                      style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--brand-primary)', marginBottom: 12 }}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input 
                        type="text" 
                        placeholder="Subject Log (e.g. Completed Ch 4: Polynomials)" 
                        className="portal-input"
                        style={{ fontSize: 13, padding: '8px 12px' }}
                        value={syllabusLogs[batch] || ''}
                        onChange={(e) => setSyllabusLogs(prev => ({ ...prev, [batch]: e.target.value }))}
                      />
                      <button className="btn btn-brand btn-sm" onClick={() => handleSaveProgress(batch)} style={{ width: '100%', justifyContent: 'center' }}>
                        Save Progress & Log
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {completedTestDuties.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, marginBottom: 16 }}>
                <span className="material-symbols-outlined" style={{ color: '#4caf50' }}>task_alt</span>
                Completed Test Duties Log
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {completedTestDuties.map((duty, idx) => (
                  <div key={idx} style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', border: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                     <div>
                       <strong style={{ display: 'block', color: '#555', fontSize: 14 }}>{duty.batch} - Weekly Test</strong>
                       <span style={{ fontSize: 12, color: '#777', display: 'block', marginTop: 4 }}>Prepared by: <strong>{duty.prepName}</strong> | Checked by: <strong>{duty.checkName}</strong></span>
                       <span style={{ fontSize: 12, color: '#777', display: 'block', marginTop: 2 }}>Syllabus: {duty.topic || 'N/A'}</span>
                     </div>
                     <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                       {duty.workflow?.finalLink && (
                         <a href={duty.workflow.finalLink} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: 12, fontWeight: '600', background: '#e8f5e9', color: '#2e7d32', borderRadius: 4, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                           <span className="material-symbols-outlined" style={{ fontSize: 14 }}>description</span>
                           Paper
                         </a>
                       )}
                       {duty.workflow?.solutionsLink && (
                         <a href={duty.workflow.solutionsLink} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: 12, fontWeight: '600', background: '#e3f2fd', color: '#1565c0', borderRadius: 4, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                           <span className="material-symbols-outlined" style={{ fontSize: 14 }}>task_alt</span>
                           Solutions
                         </a>
                       )}
                       <span style={{ background: '#4caf50', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: 12, fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                         Marks Uploaded ✓
                       </span>
                     </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

          {activeTab === 'timetable' && (
            <div className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 16, background: '#fff', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0 }}>📅 My Weekly Schedule</h2>
                <div className="badge badge-branch-manager">{timetableHeaderDate || 'CURRENT WEEK'}</div>
              </div>
              
              {Object.keys(timetable).length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>No timetable has been published yet.</div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff' }}>
                  {(() => {
                    const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
                    const slots = ['02:00 PM TO 04:00 PM', '04:30 PM TO 06:30 PM', '07:00 PM TO 09:00 PM'];
                    
                    // scheduleMatrix[slot][day] = array of lectures
                    const scheduleMatrix = {};
                    slots.forEach(slot => {
                      scheduleMatrix[slot] = {};
                      daysOfWeek.forEach(d => { scheduleMatrix[slot][d] = []; });
                    });

                    const mapCycleToDays = (label, defaultDays) => {
                       const l = (label || '').toUpperCase();
                       if (!l) return defaultDays;
                       if (l === 'ALL DAYS') return ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
                       
                       // Legacy custom handling
                       if (l === 'MON-WED-FRI') return ['MONDAY', 'WEDNESDAY', 'FRIDAY'];
                       if (l === 'TUES-THURS-SAT') return ['TUESDAY', 'THURSDAY', 'SATURDAY'];
                       if (l === 'WEEKENDS') return ['SATURDAY', 'SUNDAY'];

                       const DAYS_MAP = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
                       const FULL_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
                       
                       if (l.includes('-')) {
                         let parts = l.split('-');
                         // Normalize legacy THURS/TUES
                         let sStr = parts[0].replace('THURS', 'THU').replace('TUES', 'TUE');
                         let eStr = parts[1].replace('THURS', 'THU').replace('TUES', 'TUE');
                         let sIdx = DAYS_MAP.indexOf(sStr);
                         let eIdx = DAYS_MAP.indexOf(eStr);
                         
                         if (sIdx !== -1 && eIdx !== -1) {
                           let result = [];
                           for (let i = Math.min(sIdx, eIdx); i <= Math.max(sIdx, eIdx); i++) {
                             result.push(FULL_DAYS[i]);
                           }
                           return result;
                         }
                       } else {
                         // Single day
                         let sStr = l.replace('THURS', 'THU').replace('TUES', 'TUE');
                         let idx = DAYS_MAP.indexOf(sStr);
                         if (idx !== -1) return [FULL_DAYS[idx]];
                       }

                       return defaultDays; 
                    };

                    for (const slot of Object.keys(timetable)) {
                      for (const room of Object.keys(timetable[slot] || {})) {
                        const cell = timetable[slot][room];
                        
                        if (teacherId && cell?.monWed?.teacherId === teacherId) {
                          const days = mapCycleToDays(cell.monWedLabel, ['MONDAY', 'TUESDAY', 'WEDNESDAY']);
                          days.forEach(d => {
                            if (scheduleMatrix[slot] && scheduleMatrix[slot][d]) {
                              scheduleMatrix[slot][d].push({ room, batch: cell.batch, subject: cell.monWed.subject, topic: cell.monWed.topic });
                            }
                          });
                        }
                        
                        if (teacherId && cell?.thursSat?.teacherId === teacherId) {
                          const days = mapCycleToDays(cell.thursSatLabel, ['THURSDAY', 'FRIDAY', 'SATURDAY']);
                          days.forEach(d => {
                            if (scheduleMatrix[slot] && scheduleMatrix[slot][d]) {
                              scheduleMatrix[slot][d].push({ room, batch: cell.batch, subject: cell.thursSat.subject, topic: cell.thursSat.topic });
                            }
                          });
                        }

                        if (teacherId && cell?.extra?.teacherId === teacherId) {
                          if (scheduleMatrix[slot] && scheduleMatrix[slot]['SUNDAY']) {
                            scheduleMatrix[slot]['SUNDAY'].push({ room, batch: cell.batch, subject: cell.extra.subject, topic: '', type: 'extra' });
                          }
                        }
                      }
                    }



                    let totalLectures = 0;
                    slots.forEach(slot => {
                      daysOfWeek.forEach(d => {
                        totalLectures += scheduleMatrix[slot][d].length;
                      });
                    });

                    if (totalLectures === 0) {
                      return <div className="empty-state" style={{ padding: 24 }}>You have no assigned lectures for this week.</div>;
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {upcomingTestDuties.length > 0 && (
                          <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', padding: '16px', borderRadius: '8px' }}>
                            <h3 style={{ color: '#e65100', margin: '0 0 12px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>notification_important</span>
                              Upcoming Saturday Test Duties ({saturdayDateStr})
                            </h3>
                            <div style={{ display: 'grid', gap: '8px' }}>
                              {upcomingTestDuties.map((duty, idx) => (
                                <div key={idx} style={{ background: duty.workflow?.status === 'final_published' ? '#e8f5e9' : '#fff', padding: '12px', borderRadius: '6px', border: duty.workflow?.status === 'final_published' ? '1px solid #a5d6a7' : '1px solid #ffe0b2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                  <div>
                                    <strong style={{ fontSize: '14px', display: 'block', color: duty.workflow?.status === 'final_published' ? '#2e7d32' : '#333' }}>{duty.batch} - Weekly Test</strong>
                                    <span style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: 4 }}>Prepared by: <strong>{duty.prepName}</strong> | Checked by: <strong>{duty.checkName}</strong></span>
                                    <span style={{ fontSize: '12px', color: '#666', display: 'block', marginTop: 2 }}>Syllabus: {duty.topic || 'N/A'}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    
                                    {duty.isPreparer && (!duty.workflow || duty.workflow.status === 'draft_submitted') && (
                                      <button 
                                        className="btn-primary btn-sm"
                                        onClick={() => {
                                          setDraftModal({ isOpen: true, duty, link: '', startDate });
                                        }}
                                        style={{ background: duty.workflow?.status === 'draft_submitted' ? '#4caf50' : '' }}
                                      >
                                        {duty.workflow?.status === 'draft_submitted' ? 'Draft Submitted ✓' : 'Submit Draft Link'}
                                      </button>
                                    )}

                                    {duty.workflow?.finalLink && (
                                      <a href={duty.workflow.finalLink} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: 12, fontWeight: '600', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>description</span>
                                        Test Paper
                                      </a>
                                    )}
                                    
                                    {duty.workflow?.solutionsLink && (
                                      <a href={duty.workflow.solutionsLink} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', fontSize: 12, fontWeight: '600', background: '#e3f2fd', color: '#1565c0', border: '1px solid #bbdefb', borderRadius: '6px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>task_alt</span>
                                        Solutions
                                      </a>
                                    )}

                                    {duty.isChecker && duty.workflow?.status === 'final_published' && (
                                      <button className="btn-primary btn-sm" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => {
                                        setGradingModal({ 
                                          isOpen: true, 
                                          testId: duty.testId, 
                                          batch: duty.batch, 
                                          maxMarks: 0,
                                          testDate: saturdayDateStr,
                                          subject: duty.subject,
                                          topic: duty.topic
                                        });
                                        const initialMarks = {};
                                        students.filter(s => s.batch === duty.batch).forEach(s => {
                                          initialMarks[s.id] = '';
                                        });
                                        setMarksData(initialMarks);
                                      }}>Upload Marks</button>
                                    )}

                                    <span style={{ background: duty.workflow?.status === 'final_published' ? '#c8e6c9' : '#ffcc80', color: duty.workflow?.status === 'final_published' ? '#2e7d32' : '#e65100', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>Kaksh: {duty.room}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontFamily: "'Times New Roman', serif", fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#8bc34a', borderBottom: '2px solid #000' }}>
                            <th style={{ width: '150px', padding: '12px', borderRight: '1px solid #000' }}>TIME SLOT</th>
                            {daysOfWeek.map(day => (
                              <th key={day} style={{ padding: '12px', borderRight: '1px solid #000', minWidth: '120px' }}>{day}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {slots.map((slot, slotIdx) => (
                            <tr key={slot} style={{ borderBottom: '1px solid #000' }}>
                              <td style={{ padding: '12px', borderRight: '1px solid #000', background: '#fafafa', fontWeight: 'bold' }}>
                                {slot}
                              </td>
                              {daysOfWeek.map(day => {
                                const lecs = scheduleMatrix[slot][day] || [];
                                return (
                                  <td key={day} style={{ padding: '8px', borderRight: '1px solid #000', verticalAlign: 'top' }}>
                                    {lecs.length === 0 ? (
                                      day === 'SUNDAY' ? (
                                        <div style={{ background: '#e0f7fa', padding: '6px', borderRadius: '4px', border: '1px solid #b2ebf2', color: '#00838f', fontWeight: 'bold', fontSize: '11px' }}>Holiday</div>
                                      ) : (
                                        <span style={{ color: '#ccc' }}>-</span>
                                      )
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {lecs.map((lec, i) => (
                                          <div key={i} style={{ background: '#ffeb3b', padding: '6px', borderRadius: '4px', border: '1px solid #fbc02d', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <strong style={{ fontSize: '12px', color: '#000' }}>{lec.batch}</strong>
                                            <span style={{ fontSize: '11px', color: '#555' }}>Kaksh: {lec.room}</span>
                                            <span style={{ fontSize: '11px', color: '#d32f2f', fontWeight: 'bold' }}>{lec.subject}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

      {activeTab === 'materials' && (
        <div className="responsive-grid-1-2" style={{ gap: 24 }}>
          <div className="portal-card">
            <h2 style={{ marginBottom: 16 }}>Post New Material</h2>
            <form onSubmit={handlePostMaterial} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Batch</label>
                <select className="portal-select" value={newMaterial.batch} onChange={e => setNewMaterial({...newMaterial, batch: e.target.value})} required>
                  <option value="">Select Batch</option>
                  {assignedBatches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="portal-select" value={newMaterial.type} onChange={e => setNewMaterial({...newMaterial, type: e.target.value})}>
                  <option value="Notes">Notes / PDF</option>
                  <option value="Assignment">Assignment</option>
                  <option value="Video">Video Link</option>
                  <option value="Announcement">Announcement</option>
                  <option value="Live Link">Live Class Link (Zoom/Meet)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="portal-input" value={newMaterial.title} onChange={e => setNewMaterial({...newMaterial, title: e.target.value})} placeholder="e.g. Chapter 1: Real Numbers" required />
              </div>
              <div className="form-group">
                <label className="form-label">Google Drive Link {newMaterial.type === 'Announcement' && '(Optional)'}</label>
                <input className="portal-input" type="url" value={newMaterial.driveLink} onChange={e => setNewMaterial({...newMaterial, driveLink: e.target.value})} placeholder="https://..." required={newMaterial.type !== 'Announcement'} />
              </div>
              <div className="form-group">
                <label className="form-label">Description / Instructions</label>
                <textarea className="portal-input" rows={3} value={newMaterial.description} onChange={e => setNewMaterial({...newMaterial, description: e.target.value})} placeholder="Optional instructions..." />
              </div>
              <button type="submit" className="btn btn-brand">Post Material</button>
            </form>
          </div>

          <div className="portal-card">
            <h2 style={{ marginBottom: 16 }}>Recently Posted</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {materials.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No materials posted yet.</p> : materials.map(mat => (
                <div key={mat.id} style={{ padding: 16, background: 'var(--surface-bg)', borderRadius: 8, border: '1px solid var(--surface-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <strong>{mat.title}</strong>
                    <span className="badge badge-branch-manager">{mat.batch}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <span className="badge badge-service-manager">{mat.type}</span>
                    {mat.driveLink && mat.driveLink !== '#' && (
                      <a href={mat.driveLink} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--brand-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>link</span> Open Link
                      </a>
                    )}
                  </div>
                  {mat.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{mat.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'grading' && (
        <div className="portal-card">
          <h2 style={{ marginBottom: 16 }}>Assignment Submissions</h2>
          <div className="table-responsive">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Batch</th>
                  <th>Assignment</th>
                  <th>Submission Link</th>
                  <th>Marks/Grade</th>
                </tr>
              </thead>
              <tbody>
                {submissions.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No submissions found.</td></tr>
                ) : submissions.map(sub => (
                  <tr key={sub.id}>
                    <td>{sub.studentName}</td>
                    <td><span className="badge badge-branch-manager">{sub.batch}</span></td>
                    <td>{sub.assignmentTitle}</td>
                    <td>
                      <a href={sub.driveLink} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}>View Work</a>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input 
                          className="portal-input" 
                          type="number" 
                          placeholder="e.g. 85" 
                          defaultValue={sub.marks || ''}
                          onBlur={(e) => {
                            if(e.target.value) handleGradeSubmission(sub.id, e.target.value);
                          }}
                          style={{ width: 80, padding: 6, fontSize: 14 }}
                        />
                        {sub.graded && <span className="material-symbols-outlined" style={{ color: 'var(--status-success)', fontSize: 18 }}>check_circle</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {gradingModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ margin: '0 0 16px 0' }}>Upload Marks for {gradingModal.batch}</h2>
            <p style={{ margin: '0 0 16px 0', color: '#666' }}>
              Test: {gradingModal.subject} ({gradingModal.topic})
            </p>
            <div style={{ marginBottom: 20, background: '#f9f9f9', padding: '16px', borderRadius: '8px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Max Marks for this Test</label>
              <input 
                type="number" 
                value={gradingModal.maxMarks || ''}
                onChange={e => setGradingModal({...gradingModal, maxMarks: Number(e.target.value)})}
                className="portal-input"
                style={{ width: '120px' }}
                placeholder="e.g. 50"
              />
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: 12, textAlign: 'left' }}>Student Name</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>Marks Obtained</th>
                </tr>
              </thead>
              <tbody>
                {students.filter(s => s.batch === gradingModal.batch).map(student => (
                  <tr key={student.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: 12, fontWeight: 500 }}>{student.studentName || student.fullName}</td>
                    <td style={{ padding: 12 }}>
                      <input 
                        type="number"
                        className="portal-input"
                        style={{ width: 100 }}
                        value={marksData[student.id] !== undefined ? marksData[student.id] : ''}
                        onChange={(e) => setMarksData({...marksData, [student.id]: e.target.value})}
                        max={gradingModal.maxMarks}
                        min={0}
                        placeholder="Marks"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn-ghost" onClick={() => setGradingModal({ isOpen: false })}>Cancel</button>
              <button className="btn-primary" onClick={async () => {
                const batchStudents = students.filter(s => s.batch === gradingModal.batch);
                
                // Calculate rankings
                const results = batchStudents.map(student => {
                  const marks = Number(marksData[student.id]) || 0;
                  const percentage = gradingModal.maxMarks > 0 ? ((marks / gradingModal.maxMarks) * 100).toFixed(2) : 0;
                  return { studentId: student.id, marks, percentage };
                });
                
                // Sort to assign ranks (highest marks first)
                results.sort((a, b) => b.marks - a.marks);
                results.forEach((res, idx) => {
                  res.batchRank = idx + 1;
                });
                
                try {
                  // Save to test_marks collection
                  const testMarkDoc = {
                    testId: gradingModal.testId,
                    batch: gradingModal.batch,
                    subject: gradingModal.subject,
                    topic: gradingModal.topic,
                    testDate: gradingModal.testDate,
                    maxMarks: gradingModal.maxMarks,
                    results,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: teacherId
                  };
                  await setDoc(doc(db, 'test_marks', gradingModal.testId), testMarkDoc);
                  
                  // Update workflow status to graded so it moves to completed log
                  await setDoc(doc(db, 'test_workflows', gradingModal.testId), { status: 'graded' }, { merge: true });
                  
                  alert('Marks uploaded and rankings calculated successfully!');
                  setGradingModal({ isOpen: false });
                } catch(e) {
                  console.error(e);
                  alert('Failed to save marks.');
                }
              }}>Submit Marks</button>
            </div>
          </div>
        </div>
      )}

      {/* Draft Submission Modal */}
      {draftModal.isOpen && draftModal.duty && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--surface-card)', padding: 32, borderRadius: 12, width: 400, maxWidth: '90%', border: '1px solid var(--surface-border)' }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: 20 }}>Submit Draft Link</h2>
            <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: 14 }}>Batch: {draftModal.duty.batch} - {draftModal.duty.type}</p>
            
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>Google Doc / PDF Link</label>
              <input 
                type="url" 
                value={draftModal.link}
                onChange={e => setDraftModal({...draftModal, link: e.target.value})}
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid var(--surface-border)', background: 'var(--surface-bg)' }}
                placeholder="https://docs.google.com/..."
              />
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setDraftModal({ isOpen: false, duty: null, link: '', startDate: null })}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (!draftModal.link) {
                    alert('Please provide a link.');
                    return;
                  }
                  const d = new Date(draftModal.startDate);
                  d.setDate(d.getDate() + 3); // Thursday
                  
                  const formatDate = (dateObj) => {
                    if (!dateObj) return '';
                    return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getFullYear().toString().slice(-2)}`;
                  };

                  setDoc(doc(db, 'test_workflows', draftModal.duty.testId), {
                    batch: draftModal.duty.batch,
                    subject: draftModal.duty.subject,
                    topic: draftModal.duty.topic,
                    draftLink: draftModal.link,
                    status: 'draft_submitted',
                    deadline: formatDate(d),
                    testDate: draftModal.duty.testId.split('_')[0],
                    preparedBy: teacherId,
                    submittedAt: new Date().toISOString()
                  }, { merge: true }).then(() => {
                    alert('Draft submitted successfully!');
                    setDraftModal({ isOpen: false, duty: null, link: '', startDate: null });
                  }).catch(err => {
                    console.error(err);
                    alert('Failed to submit draft.');
                  });
                }}
                style={{ padding: '8px 24px', borderRadius: 6, border: 'none', background: '#4caf50', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
              >
                Submit Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
