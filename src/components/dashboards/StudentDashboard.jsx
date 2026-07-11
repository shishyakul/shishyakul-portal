import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { createNotification } from '../../services/notifications';
import TabPerformance from '../StudentPortfolio/TabPerformance';
import { useLocation, useNavigate } from 'react-router-dom';
import BattalionNetwork from './BattalionNetwork';

export default function StudentDashboard({ profile }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(() => {
    return location.hash.replace('#', '') || 'feed';
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
  const [attendance, setAttendance] = useState([]);
  const [timetable, setTimetable] = useState({});
  const [timetableHeaderDate, setTimetableHeaderDate] = useState('');
  const [activeTeachers, setActiveTeachers] = useState([]);
  const [isBattalionEnrolled, setIsBattalionEnrolled] = useState(false);
  const [battalionProfile, setBattalionProfile] = useState(null);
  const [studentRecord, setStudentRecord] = useState(null);
  const [lectureReports, setLectureReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const [submitForm, setSubmitForm] = useState({
    assignmentId: '',
    assignmentTitle: '',
    driveLink: ''
  });

  const [grievanceForm, setGrievanceForm] = useState({ category: '', description: '' });

  const [calendarDate, setCalendarDate] = useState(new Date());

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));

  const batchName = profile?.batch;

  useEffect(() => {
    let unsubMat, unsubSub, unsubAtt, unsubTimetable, unsubLectureReports;
    
    if (batchName) {
      // 1. Listen to Course Materials for student's batch
      const qMat = query(collection(db, 'course_materials'), where('batch', '==', batchName));
      unsubMat = onSnapshot(qMat, (snap) => {
        setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp));
      });

      // 2. Listen to Submissions by this student
      const qSub = query(collection(db, 'submissions'), where('studentId', '==', profile.studentId));
      unsubSub = onSnapshot(qSub, (snap) => {
        setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => b.timestamp - a.timestamp));
      });

      // 3. Listen to Attendance for this student's batch
      const qAtt = query(collection(db, 'attendance'), where('batch', '==', batchName));
      unsubAtt = onSnapshot(qAtt, (snap) => {
        const attRecords = snap.docs.map(d => {
          const data = d.data();
          const isAbsent = data.absenteeIds && data.absenteeIds.includes(profile.studentId);
          const lateInfo = data.lateStudents ? data.lateStudents[profile.studentId] : null;
          const selfStudyLog = data.selfStudyLogs ? data.selfStudyLogs[profile.studentId] : null;
          const inOutTime = data.inOutTimes ? data.inOutTimes[profile.studentId] : null;
          return {
            id: d.id,
            date: data.date,
            sessionType: data.sessionType || 'Regular Class',
            status: isAbsent ? 'Absent' : 'Present',
            lateInfo: lateInfo,
            selfStudyLog: selfStudyLog,
            inOutTime: inOutTime,
            timestamp: data.timestamp
          };
        });
        setAttendance(attRecords.sort((a,b) => new Date(b.date) - new Date(a.date)));
      });

      // 4. Listen to Timetable for this batch from master
      const qTimetable = doc(db, 'timetables', 'master');
      unsubTimetable = onSnapshot(qTimetable, (docSnap) => {
        if(docSnap.exists()) {
          const data = docSnap.data();
          setTimetable(data.schedule || {});
          setTimetableHeaderDate(data.headerDate || '');
        } else {
          setTimetable({});
        }
      });

      // 5. Listen to Post-Lecture Reports for this batch
      const qLectureReports = query(collection(db, 'lecture_reports'), where('batch', '==', batchName));
      unsubLectureReports = onSnapshot(qLectureReports, (snap) => {
        setLectureReports(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
      });
    }

    // 5. Listen to Faculty list for mapping names
    const qTeachers = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubTeachers = onSnapshot(qTeachers, (snap) => {
      setActiveTeachers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 6. Listen to detailed student record for fees and installments
    const qEmail = query(collection(db, 'students'), where('emailId', '==', profile.email || 'N/A'));
    const unsubStudent = onSnapshot(qEmail, (snap) => {
      // Helper to find the best duplicate record (admitted > passout > anything else)
      const findBestRecord = (docs) => {
        let best = docs[0];
        for (let doc of docs) {
           const data = doc.data();
           if (data.status === 'admitted') return doc;
           if (data.status === 'passout') best = doc;
        }
        return best;
      };

      if (!snap.empty) {
        const best = findBestRecord(snap.docs);
        setStudentRecord({ id: best.id, ...best.data() });
      } else {
        const studentName = profile.fullName || profile.displayName || profile.studentName || 'Unknown';
        
        const qName = query(collection(db, 'students'), where('studentName', '==', studentName));
        const unsubName = onSnapshot(qName, (nameSnap) => {
            if (!nameSnap.empty) {
                const best = findBestRecord(nameSnap.docs);
                setStudentRecord({ id: best.id, ...best.data() });
            } else {
                const qNameFallback = query(collection(db, 'students'), where('name', '==', studentName));
                getDocs(qNameFallback).then(fallbackSnap => {
                   if (!fallbackSnap.empty) {
                       const best = findBestRecord(fallbackSnap.docs);
                       setStudentRecord({ id: best.id, ...best.data() });
                   } else {
                       const qNameFallback2 = query(collection(db, 'students'), where('fullName', '==', studentName));
                       getDocs(qNameFallback2).then(fallbackSnap2 => {
                           if (!fallbackSnap2.empty) {
                               const best = findBestRecord(fallbackSnap2.docs);
                               setStudentRecord({ id: best.id, ...best.data() });
                           } else {
                               setStudentRecord({ notFound: true, totalFees: 0, paidInstallments: [] });
                           }
                       }).catch(err => setStudentRecord({ error: 'Fallback2 Error: ' + err.message }));
                   }
                }).catch(err => setStudentRecord({ error: 'Fallback1 Error: ' + err.message }));
            }
        }, (error) => {
            setStudentRecord({ error: 'qName Error: ' + error.message });
        });
        // We do not cleanup the nested ones properly here, but it's a fallback.
      }
    }, (error) => {
      setStudentRecord({ error: 'qEmail Error: ' + error.message });
    });

    // 7. Check Battalion Network explicitly (Bulletproof logic)
    const studentNameCheck = (profile.fullName || profile.displayName || profile.studentName || 'Unknown').trim().toLowerCase();
    
    const unsubBattalion = onSnapshot(collection(db, 'battalion_profiles'), (snap) => {
      let foundMatch = false;
      let matchedProfile = null;
      let bCount = snap.docs.length;

      for (let doc of snap.docs) {
        const data = doc.data();
        const profileName = (data.fullName || data.name || '').trim().toLowerCase();
        
        if (
          data.uid === profile?.uid || 
          data.uid === profile?.studentId || 
          (studentRecord && data.uid === studentRecord.id) || 
          profileName === studentNameCheck
        ) {
          foundMatch = true;
          matchedProfile = { id: doc.id, ...data };
          break;
        }
      }

      // Store globally for debug
      window.__debugBattalionCount = bCount;

      // Also rely on studentRecord fallback if battalion_profiles is out of sync
      if (foundMatch || studentRecord?.battalionEnrolled || studentRecord?.status === 'passout' || profile?.status === 'passout') {
        setIsBattalionEnrolled(true);
        setBattalionProfile(matchedProfile || {});
      } else {
        setIsBattalionEnrolled(false);
        setBattalionProfile(null);
      }
    });

    setLoading(false);
    return () => { 
      if (unsubMat) unsubMat(); 
      if (unsubSub) unsubSub(); 
      if (unsubAtt) unsubAtt(); 
      if (unsubTimetable) unsubTimetable(); 
      if (unsubLectureReports) unsubLectureReports();
      unsubTeachers(); 
      unsubStudent(); 
      unsubBattalion(); 
    };
  }, [batchName, profile?.studentId, profile?.uid, profile?.email, profile?.fullName, profile?.displayName, profile?.studentName, studentRecord?.id, studentRecord?.battalionEnrolled]);

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    if (!submitForm.assignmentId || !submitForm.driveLink) return alert('Select assignment and provide Drive link');
    
    try {
      await addDoc(collection(db, 'submissions'), {
        studentId: profile.studentId,
        studentName: profile.fullName,
        batch: batchName,
        assignmentId: submitForm.assignmentId,
        assignmentTitle: submitForm.assignmentTitle,
        driveLink: submitForm.driveLink,
        graded: false,
        timestamp: serverTimestamp()
      });
      setSubmitForm({ assignmentId: '', assignmentTitle: '', driveLink: '' });
      alert('Assignment submitted successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to submit assignment');
    }
  };

  const handleSupportSubmit = async (e) => {
    e.preventDefault();
    if (!grievanceForm.category || !grievanceForm.description) return alert('Fill all fields');
    try {
      await addDoc(collection(db, 'grievances'), {
        studentId: profile.studentId || profile.uid,
        studentName: profile.fullName,
        batch: batchName,
        category: grievanceForm.category,
        description: grievanceForm.description,
        status: 'Pending',
        timestamp: serverTimestamp()
      });
      
      await createNotification('branch_manager', 'grievance_new', {
        studentName: profile?.fullName || 'Student',
        category: grievanceForm.category
      });
      await createNotification('service_manager', 'grievance_new', {
        studentName: profile?.fullName || 'Student',
        category: grievanceForm.category
      });

      setGrievanceForm({ category: '', description: '' });
      alert('Support ticket submitted successfully. The Service Manager will look into it.');
    } catch (err) {
      console.error(err);
      alert('Failed to submit ticket');
    }
  };

  const isAlumniOnly = profile?.status === 'passout' || studentRecord?.status === 'passout';

  // Force active tab to battalion if they are an alumni
  useEffect(() => {
    if (isAlumniOnly && activeTab !== 'battalion') {
      setActiveTab('battalion');
    }
  }, [isAlumniOnly, activeTab]);


  const assignments = materials.filter(m => m.type === 'Assignment');

  // Calculate course completion based on graded assignments
  const totalAssignments = assignments.length;
  const gradedSubmissions = submissions.filter(s => s.graded);
  const completionPercentage = totalAssignments > 0 ? Math.round((gradedSubmissions.length / totalAssignments) * 100) : 0;
  
  let totalMarks = 0;
  gradedSubmissions.forEach(s => totalMarks += (s.marks || 0));
  const averageMarks = gradedSubmissions.length > 0 ? Math.round(totalMarks / gradedSubmissions.length) : 0;

  const allFeedbacks = studentRecord?.feedbacks || [];
  const allPtms = studentRecord?.ptmNotices || [];
  const allTests = studentRecord?.testHistory || [];
  
  const pendingPtms = allPtms.filter(p => p.status === 'pending');
  const recentTests = allTests.filter(t => {
    let d = new Date(t.date);
    if (isNaN(d.getTime()) && typeof t.date === 'string') {
      d = new Date(t.date.split('/').reverse().join('-'));
    }
    return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  });

  const performanceBadge = allFeedbacks.length;
  const noticeBadge = pendingPtms.length + recentTests.length;

  useEffect(() => {
    const event = new CustomEvent('updateSidebarBadges', { 
      detail: { 
        'Performance': { count: performanceBadge, id: performanceBadge }, 
        'Teacher Feeds & Notices': { count: noticeBadge, id: noticeBadge } 
      } 
    });
    window.dispatchEvent(event);
  }, [performanceBadge, noticeBadge]);

  if (loading) return <div className="empty-state"><div className="spinner"/></div>;

  return (
    <div className="dashboard student-dashboard">
      <div className="dashboard-header">
        <h1>Student Portal</h1>
        <p>Welcome back, {profile?.fullName ?? 'Student'} • {batchName || 'No Batch Assigned'}</p>
      </div>


      {!batchName && !isAlumniOnly ? (
        <div className="empty-state">Your batch has not been assigned yet. Please contact administration.</div>
      ) : (
        <>
          {activeTab === 'feed' && (
            <div className="portal-card">
              <h2><span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>dynamic_feed</span>Academic Feed</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 20 }}>
                {materials.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No materials posted for your batch yet.</p> : materials.map(mat => (
                  <div key={mat.id} style={{ padding: 20, background: 'var(--surface-bg)', borderRadius: 12, border: '1px solid var(--surface-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <h3 style={{ fontSize: 18 }}>{mat.title}</h3>
                      <span className={`badge ${mat.type === 'Assignment' ? 'badge-admin' : 'badge-service-manager'}`}>{mat.type}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Posted by {mat.teacherName}</p>
                    {mat.description && <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 16 }}>{mat.description}</p>}
                    
                    <a href={mat.driveLink} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', color: 'var(--brand-primary)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span> Open Material
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'submit' && (
            <div className="grid-1-2">
              <div className="portal-card">
                <h2 style={{ marginBottom: 16 }}>Submit Assignment</h2>
                <form onSubmit={handleSubmitAssignment} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Select Assignment</label>
                    <select 
                      className="portal-select" 
                      value={submitForm.assignmentId} 
                      onChange={e => {
                        const target = assignments.find(a => a.id === e.target.value);
                        setSubmitForm({...submitForm, assignmentId: e.target.value, assignmentTitle: target ? target.title : ''});
                      }} 
                      required
                    >
                      <option value="">-- Choose Assignment --</option>
                      {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Your Google Drive Link</label>
                    <input 
                      className="portal-input" 
                      type="url" 
                      value={submitForm.driveLink} 
                      onChange={e => setSubmitForm({...submitForm, driveLink: e.target.value})} 
                      placeholder="https://drive.google.com/..." 
                      required 
                    />
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Make sure the link sharing is set to "Anyone with the link".</p>
                  </div>
                  <button type="submit" className="btn btn-brand">Submit Work</button>
                </form>
              </div>

              <div className="portal-card">
                <h2 style={{ marginBottom: 16 }}>My Submissions</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {submissions.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>You haven't submitted anything yet.</p> : submissions.map(sub => (
                    <div key={sub.id} style={{ padding: 16, background: 'var(--surface-bg)', borderRadius: 8, border: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{sub.assignmentTitle}</strong>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                          Status: {sub.graded ? <span style={{ color: 'var(--status-success)' }}>Graded</span> : <span style={{ color: 'var(--status-warning)' }}>Pending Grading</span>}
                        </div>
                      </div>
                      {sub.graded && (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand-primary)' }}>{sub.marks}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Marks</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'timetable' && (
            <div className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
              {Object.keys(timetable).length === 0 ? (
                <div style={{ padding: 24 }} className="empty-state">No timetable has been published for your batch yet.</div>
              ) : (
                <div style={{ overflowX: 'auto', background: '#fff' }}>
                  {(() => {
                    let mySlot = null;
                    let myRoom = null;
                    let myData = null;

                    for (const slot of Object.keys(timetable)) {
                      for (const room of Object.keys(timetable[slot] || {})) {
                        if (timetable[slot][room]?.batch === batchName) {
                          mySlot = slot;
                          myRoom = room;
                          myData = timetable[slot][room];
                          break;
                        }
                      }
                      if (myData) break;
                    }

                    if (!myData) {
                      return <div style={{ padding: 24 }} className="empty-state">Your batch is not scheduled in the current timetable.</div>;
                    }

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

                    const cycle1Days = mapCycleToDays(myData.monWedLabel, ['MONDAY', 'TUESDAY', 'WEDNESDAY']);
                    const cycle2Days = mapCycleToDays(myData.thursSatLabel, ['THURSDAY', 'FRIDAY', 'SATURDAY']);
                    
                    const scheduleByDay = {};
                    cycle1Days.forEach(d => { scheduleByDay[d] = { ...myData.monWed, type: 'regular' }; });
                    cycle2Days.forEach(d => { scheduleByDay[d] = { ...myData.thursSat, type: 'regular' }; });

                    if (myData?.test?.topic) {
                      scheduleByDay['SATURDAY'] = { type: 'test', topic: myData.test.topic };
                    }
                    if (myData?.extra?.subject || myData?.extra?.teacherId) {
                      scheduleByDay['SUNDAY'] = { ...myData.extra, type: 'extra' };
                    }

                    const parseStartDate = (text) => {
                      const match = (text || '').match(/(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})/);
                      if (match) {
                        let [_, d, m, y] = match;
                        return new Date(y.length === 2 ? 2000 + parseInt(y) : parseInt(y), parseInt(m) - 1, parseInt(d));
                      }
                      return null;
                    };
                    const startDate = parseStartDate(timetableHeaderDate);
                    
                    const formatDate = (dateObj) => {
                      if (!dateObj) return '';
                      return `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth()+1).toString().padStart(2, '0')}/${dateObj.getFullYear().toString().slice(-2)}`;
                    };

                    const daysOfWeek = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

                    return (
                      <div style={{ minWidth: 800, fontFamily: "'Times New Roman', serif" }}>
                        <div style={{ borderBottom: '2px solid #000', padding: '16px', textAlign: 'center' }}>
                          <h1 style={{ margin: 0, fontSize: '28px', letterSpacing: '2px', fontWeight: 'bold' }}>SHISHYAKUL</h1>
                          <p style={{ margin: '4px 0 0 0', fontSize: '14px', letterSpacing: '4px' }}>EMPOWER YOURSELF</p>
                        </div>

                        <div style={{ borderBottom: '2px solid #000', padding: '12px', textAlign: 'center', background: '#fff' }}>
                          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>WEEKLY SCHEDULE OF CLASS {batchName.toUpperCase()}</h2>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', borderBottom: '1px solid #000' }}>
                          <div style={{ padding: '12px', borderRight: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <strong style={{ fontSize: '24px' }}>TIME</strong>
                          </div>
                          <div style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffebee' }}>
                            <strong style={{ fontSize: '18px' }}>REGULAR LECTURE {mySlot}</strong>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', borderBottom: '2px solid #000' }}>
                          <div style={{ padding: '12px', borderRight: '2px solid #000', background: '#ffeb3b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <strong style={{ fontSize: '20px' }}>KAKSH</strong>
                          </div>
                          <div style={{ padding: '12px', background: '#ffeb3b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <strong style={{ fontSize: '20px' }}>{myRoom}</strong>
                          </div>
                        </div>

                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                          <thead>
                            <tr style={{ background: '#8bc34a', borderBottom: '2px solid #000' }}>
                              <th style={{ width: '150px', padding: '10px', borderRight: '2px solid #000', borderLeft: '2px solid #000' }}>DATE</th>
                              <th style={{ padding: '10px', borderRight: '1px solid #000' }}>SUBJECT</th>
                              <th style={{ padding: '10px', borderRight: '1px solid #000' }}>CONTENT</th>
                              <th style={{ width: '200px', padding: '10px', borderRight: '2px solid #000' }}>GURU</th>
                            </tr>
                          </thead>
                          <tbody>
                            {daysOfWeek.map((day, idx) => {
                              const cellData = scheduleByDay[day] || {};
                              let dateDisplay = day;
                              if (startDate) {
                                const currentDate = new Date(startDate);
                                currentDate.setDate(startDate.getDate() + idx);
                                dateDisplay = (
                                  <>
                                    <div style={{ fontSize: '14px' }}>{formatDate(currentDate)}</div>
                                    <div style={{ fontWeight: 'bold' }}>{day}</div>
                                  </>
                                );
                              }

                              const teacherName = activeTeachers?.find(t => t.id === cellData.teacherId)?.fullName || '';

                              let subjectContent = cellData.subject || '-';
                              let topicContent = cellData.topic || '-';
                              let guruContent = teacherName ? teacherName.toUpperCase() : '-';

                              if (cellData.type === 'test') {
                                subjectContent = <span style={{ color: '#e91e63', fontWeight: 'bold' }}>WEEKLY TEST</span>;
                                topicContent = cellData.topic;
                                guruContent = '-';
                              }

                              if (!cellData.subject && !cellData.topic && day === 'SUNDAY') {
                                return (
                                  <tr key={day} style={{ borderBottom: '1px solid #000' }}>
                                    <td style={{ padding: '12px 8px', borderRight: '2px solid #000', borderLeft: '2px solid #000' }}>
                                      {dateDisplay}
                                    </td>
                                    <td colSpan={3} style={{ padding: '12px 8px', borderRight: '2px solid #000', textAlign: 'center' }}>
                                      <div style={{ background: '#e0f7fa', padding: '8px', borderRadius: '4px', border: '1px solid #b2ebf2', color: '#00838f', fontWeight: 'bold', fontSize: '12px', display: 'inline-block' }}>Holiday</div>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={day} style={{ borderBottom: '1px solid #000' }}>
                                  <td style={{ padding: '12px 8px', borderRight: '2px solid #000', borderLeft: '2px solid #000' }}>
                                    {dateDisplay}
                                  </td>
                                  <td style={{ padding: '12px 8px', borderRight: '1px solid #000', fontWeight: 'bold' }}>
                                    {subjectContent}
                                  </td>
                                  <td style={{ padding: '12px 8px', borderRight: '1px solid #000' }}>
                                    {topicContent}
                                  </td>
                                  <td style={{ padding: '12px 8px', borderRight: '2px solid #000', color: '#03a9f4', fontWeight: 'bold' }}>
                                    {guruContent}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="portal-card" style={{ padding: 0 }}>
              <TabPerformance student={{ ...profile, id: profile.studentId || profile.uid, batch: batchName }} allFeedbacks={allFeedbacks} />
            </div>
          )}

          {activeTab === 'attendance' && (() => {
            const currentYear = calendarDate.getFullYear();
            const currentMonth = calendarDate.getMonth();
            const daysInMonth = getDaysInMonth(currentYear, currentMonth);
            const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

            return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Calendar Visualizer */}
              <div className="portal-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={{ margin: 0 }}>Attendance Calendar</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn-ghost btn-sm" onClick={handlePrevMonth} style={{ padding: '4px 8px' }}>
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <strong style={{ fontSize: 16, minWidth: 120, textAlign: 'center' }}>
                      {monthNames[currentMonth]} {currentYear}
                    </strong>
                    <button className="btn-ghost btn-sm" onClick={handleNextMonth} style={{ padding: '4px 8px' }}>
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                </div>

                <div style={{ maxWidth: 450, margin: '0 auto' }}>
                  <div className="grid-7" style={{ textAlign: 'center', marginBottom: 8 }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} style={{ fontWeight: 'bold', color: 'var(--text-secondary)', fontSize: 13 }}>{d}</div>
                    ))}
                  </div>

                  <div className="grid-7">
                    {Array.from({ length: firstDay }).map((_, i) => (
                      <div key={`empty-${i}`} style={{
                        aspectRatio: '1',
                        border: '1px solid var(--surface-border)',
                        borderRadius: 6,
                        background: 'rgba(0,0,0,0.02)'
                      }} />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      
                      const attRecord = attendance.find(a => a.date === dateString);
                      let bgColor = 'var(--surface-base)';
                      let color = 'var(--text-primary)';
                      let border = '1px solid var(--surface-border)';
                      let tooltipTitle = '';

                      if (attRecord) {
                        if (attRecord.status === 'Present') {
                          if (attRecord.lateInfo) {
                            bgColor = 'rgba(249, 115, 22, 0.15)'; // light orange
                            color = '#f97316';
                            border = '1px solid #f97316';
                            tooltipTitle = `Late by ${attRecord.lateInfo.minutes} mins. Reason: ${attRecord.lateInfo.reason}`;
                          } else {
                            bgColor = 'rgba(16, 185, 129, 0.15)';
                            color = 'var(--status-success)';
                            border = '1px solid var(--status-success)';
                            tooltipTitle = 'Present';
                          }
                        } else {
                          bgColor = 'rgba(239, 68, 68, 0.15)';
                          color = 'var(--status-error)';
                          border = '1px solid var(--status-error)';
                          tooltipTitle = 'Absent';
                        }
                      }

                      return (
                        <div key={day} title={tooltipTitle} style={{ 
                          aspectRatio: '1', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          background: bgColor,
                          color: color,
                          border: border,
                          borderRadius: 6,
                          fontWeight: 'bold',
                          fontSize: 14,
                          cursor: tooltipTitle ? 'help' : 'default'
                        }}>
                          {day}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid-1-2">
                <div className="portal-card" style={{ textAlign: 'center', padding: '40px 20px', height: 'fit-content' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--status-info)', marginBottom: 16 }}>fact_check</span>
                  <h3 style={{ fontSize: 36, fontWeight: 800, margin: '8px 0' }}>
                    {attendance.length > 0 ? Math.round((attendance.filter(a => a.status === 'Present').length / attendance.length) * 100) : 100}%
                  </h3>
                  <p style={{ color: 'var(--text-secondary)' }}>Overall Attendance</p>
                </div>
                <div className="portal-card">
                  <h2 style={{ marginBottom: 16 }}>Attendance Log</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {attendance.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No attendance records found.</p> : attendance.map(att => (
                      <div key={att.id} style={{ padding: 16, background: 'var(--surface-bg)', borderRadius: 8, border: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span className="material-symbols-outlined" style={{ color: att.status === 'Present' && !att.lateInfo ? 'var(--status-success)' : att.lateInfo ? '#f97316' : 'var(--status-error)' }}>
                            {att.status === 'Present' && !att.lateInfo ? 'check_circle' : att.lateInfo ? 'schedule' : 'cancel'}
                          </span>
                          <div>
                            <strong style={{ fontSize: 15 }}>{new Date(att.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                            {att.lateInfo ? (
                              <div style={{ fontSize: 13, color: '#f97316', marginTop: 2 }}>
                                Late by {att.lateInfo.minutes} mins • {att.lateInfo.reason}
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{att.notes || 'No remarks'}</div>
                            )}
                          </div>
                        </div>
                        <span className={`badge`} style={{ 
                          background: att.lateInfo ? 'rgba(249, 115, 22, 0.1)' : undefined,
                          color: att.lateInfo ? '#ea580c' : undefined
                        }}>{att.lateInfo ? 'Late' : att.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {attendance.some(att => att.sessionType === 'Self-Study' && att.selfStudyLog) && (
                <div className="portal-card" style={{ marginTop: 24 }}>
                  <h2 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>menu_book</span>
                    Self-Study Activity Logs
                  </h2>
                  <div className="grid-auto-300">
                    {attendance.filter(att => att.sessionType === 'Self-Study' && att.selfStudyLog).map(att => (
                      <div key={att.id} style={{ background: 'var(--surface-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--surface-border)', paddingBottom: 8 }}>
                          <strong style={{ fontSize: 14 }}>{new Date(att.date).toLocaleDateString()}</strong>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                            <span>In: {att.inOutTime?.in || '--'}</span>
                            <span>Out: {att.inOutTime?.out || '--'}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--brand-primary)', marginTop: 2 }}>subject</span>
                            <div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Subject</div>
                              <div style={{ fontSize: 14, fontWeight: 500 }}>{att.selfStudyLog.subject || 'Not specified'}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f97316', marginTop: 2 }}>import_contacts</span>
                            <div>
                              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Topic / Syllabus</div>
                              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{att.selfStudyLog.topic || 'No details provided'}</div>
                            </div>
                          </div>
                        </div>
                        {att.selfStudyLog.teacherScore !== undefined && (
                          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f57c00' }}>star</span>
                              Teacher Review
                            </span>
                            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--brand-primary)' }}>
                              {att.selfStudyLog.teacherScore} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>/ 10</span>
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            );
          })()}

          {activeTab === 'performance' && (
            <div className="grid-2">
              <div className="portal-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--status-success)', marginBottom: 16 }}>task_alt</span>
                <h3 style={{ fontSize: 36, fontWeight: 800, margin: '8px 0' }}>{completionPercentage}%</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Assignments Completed</p>
              </div>
              <div className="portal-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--brand-primary)', marginBottom: 16 }}>military_tech</span>
                <h3 style={{ fontSize: 36, fontWeight: 800, margin: '8px 0' }}>{averageMarks}</h3>
                <p style={{ color: 'var(--text-secondary)' }}>Average Grade</p>
              </div>
            </div>
          )}

          {activeTab === 'finances' && (() => {
            if (!studentRecord) {
              return <div className="empty-state"><div className="spinner" /> Fetching ledger data...</div>;
            }
            if (studentRecord.notFound) {
              return (
                <div className="empty-state">
                   Could not find student ledger. 
                   <br/><br/>
                   <small>Debug Info: Email ({profile?.email}), Name ({profile?.fullName}), Batch ({batchName})</small>
                </div>
              );
            }
            
            const dataSource = studentRecord;
            const totalFees = dataSource.totalFees || 0;
            const paidInstallments = dataSource.paidInstallments || [];
            const paymentDetails = dataSource.paymentDetails || {};
            const installmentAmount = dataSource.installments ? totalFees / dataSource.installments : 0;
            const paidAmount = paidInstallments.length * installmentAmount;
            const pendingAmount = totalFees - paidAmount;
            
            return (
              <div className="grid-1-2">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="portal-card" style={{ textAlign: 'center', padding: '30px 20px', borderLeft: '4px solid var(--brand-primary)' }}>
                    <h3 style={{ fontSize: 24, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>₹{totalFees.toLocaleString()}</h3>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>Total Course Fees</p>
                  </div>
                  <div className="portal-card" style={{ textAlign: 'center', padding: '30px 20px', borderLeft: '4px solid var(--status-success)' }}>
                    <h3 style={{ fontSize: 24, margin: '0 0 8px 0', color: 'var(--status-success)' }}>₹{paidAmount.toLocaleString()}</h3>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>Amount Paid</p>
                  </div>
                  <div className="portal-card" style={{ textAlign: 'center', padding: '30px 20px', borderLeft: '4px solid var(--status-error)' }}>
                    <h3 style={{ fontSize: 24, margin: '0 0 8px 0', color: 'var(--status-error)' }}>₹{pendingAmount.toLocaleString()}</h3>
                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 13 }}>Pending Dues</p>
                  </div>
                </div>
                
                <div className="portal-card">
                  <h2 style={{ marginBottom: 16 }}>Payment History</h2>
                  {paidInstallments.length === 0 ? (
                    <div className="empty-state">No payments recorded yet.</div>
                  ) : (
                    <table className="portal-table">
                      <thead>
                        <tr>
                          <th>Installment #</th>
                          <th>Amount</th>
                          <th>Payment Date</th>
                          <th>Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paidInstallments.map((instIdx) => {
                          const details = paymentDetails[instIdx] || {};
                          return (
                            <tr key={instIdx}>
                              <td>Installment {instIdx + 1}</td>
                              <td style={{ color: 'var(--status-success)', fontWeight: 600 }}>₹{Math.round(installmentAmount).toLocaleString()}</td>
                              <td>{details.paidAt ? new Date(details.paidAt).toLocaleDateString() : 'N/A'}</td>
                              <td><span className="badge badge-service-manager">{details.mode || 'Cash'}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            );
          })()}

          {activeTab === 'support' && (
            <div className="portal-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--status-error)' }}>support_agent</span>
                <h2 style={{ margin: '12px 0 8px 0' }}>Grievance & Support Desk</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Submit a ticket to the Service Manager (Rohan Sir). We aim to resolve all issues within 24 hours.</p>
              </div>

              <form onSubmit={handleSupportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select 
                    className="portal-select" 
                    value={grievanceForm.category} 
                    onChange={e => setGrievanceForm({...grievanceForm, category: e.target.value})}
                    required
                  >
                    <option value="">-- Select Category --</option>
                    <option value="Academic">Academic (Teacher / Syllabus)</option>
                    <option value="Infrastructure">Infrastructure (AC, Seating, Cleaning)</option>
                    <option value="Batch Change">Batch Change Request</option>
                    <option value="Fee Issue">Fee/Payment Issue</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Describe your issue clearly</label>
                  <textarea 
                    className="portal-input" 
                    rows="5"
                    value={grievanceForm.description} 
                    onChange={e => setGrievanceForm({...grievanceForm, description: e.target.value})}
                    placeholder="Provide details about the problem..."
                    required
                  ></textarea>
                </div>
                <button type="submit" className="btn btn-brand" style={{ background: 'var(--status-error)', borderColor: 'var(--status-error)' }}>
                  Submit Ticket
                </button>
              </form>
            </div>
          )}

          {activeTab === 'feedback_ptm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>rate_review</span>
                Teacher Feeds & Notices
              </h2>
              
              {/* Recent Test Results */}
              <div className="portal-card" style={{ borderTop: '4px solid #f59e0b' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined">military_tech</span>
                  Recent Test Results
                </h3>
                {recentTests.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No new tests graded in the last 7 days.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[...recentTests].reverse().map((test, idx) => (
                      <div key={idx} style={{ padding: 16, background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <strong style={{ fontSize: 16, color: '#b45309' }}>{test.subject} <span style={{fontSize: 12, fontWeight: 'normal', opacity: 0.8}}>({test.type || 'Test'})</span></strong>
                          <span className="badge" style={{ background: '#f59e0b', color: 'white' }}>NEW SCORE</span>
                        </div>
                        <p style={{ margin: '0 0 4px 0', fontSize: 14 }}><strong>Date:</strong> {test.date}</p>
                        <p style={{ margin: 0, fontSize: 14 }}>
                          <strong>Score:</strong> <span style={{ fontSize: 16, fontWeight: 'bold' }}>{test.obtainedMarks ?? test.marks ?? 0} / {test.maxMarks || '-'}</span> <span style={{ color: 'var(--text-secondary)' }}>({test.percentage ?? (test.maxMarks ? (((test.obtainedMarks ?? test.marks ?? 0) / test.maxMarks) * 100).toFixed(2) : 0)}%)</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Post-Lecture Reports Section */}
              <div className="portal-card" style={{ borderTop: '4px solid #10b981' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#10b981', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined">description</span>
                  Recent Class Summaries & Homework
                </h3>
                {lectureReports.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No class summaries available.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {lectureReports.slice(0, 10).map((rep) => (
                      <div key={rep.id} style={{ padding: 16, background: 'var(--surface-bg)', borderRadius: 8, border: '1px solid var(--surface-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <strong style={{ fontSize: 16 }}>{rep.subject} <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal', fontSize: 14 }}>by {rep.teacherName}</span></strong>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{rep.date}</span>
                        </div>
                        <p style={{ margin: '0 0 8px 0', fontSize: 14 }}><strong>Topic Taught:</strong> {rep.topicTaught}</p>
                        <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 6, marginBottom: 8, border: '1px solid #bbf7d0' }}>
                          <strong style={{ color: '#166534', display: 'block', marginBottom: 4 }}>Homework Assigned:</strong>
                          <span style={{ color: '#166534', fontSize: 14 }}>{rep.homework}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 14 }}><strong>Next Target:</strong> {rep.nextTarget}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* PTM Notices Section */}
              <div className="portal-card" style={{ borderTop: '4px solid #d32f2f' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#d32f2f', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined">warning</span>
                  Parent-Teacher Meeting (PTM) Notices
                </h3>
                {allPtms.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No PTM notices scheduled.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[...allPtms].reverse().map((ptm, idx) => (
                      <div key={idx} style={{ padding: 16, background: ptm.status === 'pending' ? '#ffebee' : '#f5f5f5', borderRadius: 8, border: ptm.status === 'pending' ? '1px solid #ffcdd2' : '1px solid #e0e0e0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <strong style={{ fontSize: 16 }}>Requested by: {ptm.teacherName}</strong>
                          <span className={`badge ${ptm.status === 'pending' ? 'badge-admin' : 'badge-service-manager'}`} style={{ background: ptm.status === 'pending' ? '#d32f2f' : '#757575', color: 'white' }}>
                            {ptm.status.toUpperCase()}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 4px 0', fontSize: 14 }}><strong>Scheduled Date:</strong> {new Date(ptm.dateScheduled).toLocaleDateString()}</p>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}><strong>Reason:</strong> {ptm.reason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>


            </div>
          )}

          {activeTab === 'battalion' && isBattalionEnrolled && (
            <BattalionNetwork profile={{ ...profile, ...studentRecord, ...battalionProfile }} />
          )}
        </>
      )}
    </div>
  );
}
