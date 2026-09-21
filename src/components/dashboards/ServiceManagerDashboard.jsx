import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../NotificationBell';
import PersonalAttendance from './shared/PersonalAttendance';
import PersonalSalary from './shared/PersonalSalary';

export default function ServiceManagerDashboard({ profile }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const rohanId = profile?.id || user?.uid || '';
  const activeTab = location.hash.replace('#', '');
  
  const [stats, setStats] = useState({ pendingGrievances: 0, pendingDemos: 0, unassignedStudents: 0 });
  const [timetable, setTimetable] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [syllabusProgress, setSyllabusProgress] = useState([]);
  const [testWorkflows, setTestWorkflows] = useState([]);
  const [lectureReports, setLectureReports] = useState([]);
  const [todayTeacherAttendance, setTodayTeacherAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [selectedSlotOverride, setSelectedSlotOverride] = useState('auto');
  const [subTab, setSubTab] = useState('overview'); // 'overview' or 'analytics'
  const [loading, setLoading] = useState(true);

  const CLASSROOMS = ['SAPTARISHI', 'MEGH SINGH', 'TANAJI KAKSH', 'AHOM KAKSH', 'MANIKARNIKA 1', 'MANIKARNIKA 2'];
  const SLOTS = ['02:00 PM TO 04:00 PM', '04:30 PM TO 06:30 PM', '07:00 PM TO 09:00 PM'];

  const getTodayDateStr = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  };

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      const st = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setStudents(st);
      
      let unassigned = 0;
      let pendingDms = 0;
      st.forEach(s => {
        if (!s.batch) unassigned++;
        if (s.status === 'demo' && s.demoCompletionStatus !== 'completed') pendingDms++;
      });
      setStats(prev => ({ ...prev, unassignedStudents: unassigned, pendingDemos: pendingDms }));
    });

    const unsubGrievances = onSnapshot(collection(db, 'faculty_grievances'), (snap) => {
      let pending = 0;
      snap.forEach(d => { if (d.data().status !== 'Resolved') pending++; });
      setStats(prev => ({ ...prev, pendingGrievances: pending }));
    });

    const unsubTimetable = onSnapshot(doc(db, 'timetables', 'master'), (docSnap) => {
      if (docSnap.exists()) setTimetable(docSnap.data().schedule || {});
    });

    const unsubTeachers = onSnapshot(collection(db, 'users'), (snap) => {
      const fac = [];
      snap.forEach(d => {
        if (d.data().role === 'faculty' || d.data().role === 'teacher') fac.push({ id: d.id, ...d.data() });
      });
      setTeachers(fac);
    });

    const unsubTests = onSnapshot(collection(db, 'test_workflows'), (snap) => {
      setTestWorkflows(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
      setAttendanceLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubSyllabus = onSnapshot(collection(db, 'syllabus_progress'), (snap) => {
      setSyllabusProgress(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubLectureReports = onSnapshot(collection(db, 'lecture_reports'), (snap) => {
      setLectureReports(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    });

    const todayStr = getTodayDateStr();
    const qTodayTeacherAtt = query(collection(db, 'teacher_attendance'), where('date', '==', todayStr));
    const unsubTodayTeacherAtt = onSnapshot(qTodayTeacherAtt, (snap) => {
      setTodayTeacherAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubLeaveRequests = onSnapshot(collection(db, 'leave_requests'), (snap) => {
      setLeaveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    setTimeout(() => setLoading(false), 300);
    return () => {
      unsubStudents();
      unsubGrievances();
      unsubTimetable();
      unsubTeachers();
      unsubTests();
      unsubAttendance();
      unsubSyllabus();
      unsubLectureReports();
      unsubTodayTeacherAtt();
      unsubLeaveRequests();
    };
  }, []);

  if (loading) return <div className="empty-state"><div className="spinner"/></div>;

  // KPIs
  const activeStudentsCount = students.filter(s => s.status === 'admitted').length;
  const todayStr = getTodayDateStr();
  const todaysAttendance = attendanceLogs.filter(a => a.date === todayStr);
  let totalAbsentToday = 0;
  todaysAttendance.forEach(a => { totalAbsentToday += (a.absenteeIds?.length || 0); });
  const attendanceRate = activeStudentsCount > 0 
    ? Math.max(0, Math.round(((activeStudentsCount - totalAbsentToday) / activeStudentsCount) * 100))
    : 0;

  // Teacher Presence Status Helpers
  const getTeacherStatus = (teacherId) => {
    const attRecord = todayTeacherAttendance.find(r => r.teacherId === teacherId);
    if (attRecord) {
      return {
        type: 'present',
        punchIn: attRecord.punchIn,
        punchOut: attRecord.punchOut,
        status: attRecord.status || 'On Time'
      };
    }

    const onLeave = leaveRequests.some(req => 
      req.teacherId === teacherId &&
      req.status === 'approved' &&
      todayStr >= req.startDate &&
      todayStr <= req.endDate
    );

    if (onLeave) {
      return { type: 'leave' };
    }

    return { type: 'absent' };
  };

  const presentTeachersCount = teachers.filter(t => todayTeacherAttendance.some(r => r.teacherId === t.id)).length;
  const totalTeachersCount = teachers.length;

  // Chart Data: Syllabus
  const syllabusData = Object.values(
    syllabusProgress.reduce((acc, curr) => {
      if (!acc[curr.batch]) acc[curr.batch] = { name: curr.batch, total: 0, count: 0 };
      acc[curr.batch].total += Number(curr.progress || 0);
      acc[curr.batch].count += 1;
      return acc;
    }, {})
  ).map(b => ({ name: b.name, avgProgress: Math.round(b.total / b.count) })).sort((a,b) => b.avgProgress - a.avgProgress).slice(0, 10);

  // Chart Data: Workload
  const workloadData = teachers.map(t => {
    let count = 0;
    Object.values(timetable).forEach(slotObj => {
      Object.values(slotObj || {}).forEach(cell => {
        if (cell?.monWed?.teacherId === t.id) count += 3;
        if (cell?.thursSat?.teacherId === t.id) count += 3;
        if (cell?.extra?.teacherId === t.id) count += 1;
      });
    });
    return { name: t.fullName?.split(' ')[0] || 'Unknown', count };
  }).sort((a, b) => b.count - a.count).slice(0, 10);

  // Today's Date Calculation & Schedule parsing
  const todayDate = new Date();
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const currentDay = days[todayDate.getDay()];

  // Dynamic slot detection
  const getCurrentSlot = () => {
    const hours = todayDate.getHours();
    const minutes = todayDate.getMinutes();
    const timeVal = hours * 60 + minutes;

    // Slot 1: 02:00 PM TO 04:00 PM -> 14:00 (840) to 16:00 (960)
    // Slot 2: 04:30 PM TO 06:30 PM -> 16:30 (990) to 18:30 (1110)
    // Slot 3: 07:00 PM TO 09:00 PM -> 19:00 (1140) to 21:00 (1260)
    if (timeVal >= 840 && timeVal <= 960) return '02:00 PM TO 04:00 PM';
    if (timeVal >= 990 && timeVal <= 1110) return '04:30 PM TO 06:30 PM';
    if (timeVal >= 1140 && timeVal <= 1260) return '07:00 PM TO 09:00 PM';
    return null;
  };

  const autoActiveSlot = getCurrentSlot();
  const activeSlot = selectedSlotOverride === 'auto' ? autoActiveSlot : selectedSlotOverride;

  const getClassroomLecture = (room, slot) => {
    if (!slot || !timetable[slot] || !timetable[slot][room]) return null;
    const cell = timetable[slot][room];
    if (!cell || !cell.batch) return null;

    let teacherId = null;
    let subject = '';
    
    if (['MONDAY', 'TUESDAY', 'WEDNESDAY'].includes(currentDay)) {
      teacherId = cell.monWed?.teacherId;
      subject = cell.monWed?.subject;
    } else if (['THURSDAY', 'FRIDAY', 'SATURDAY'].includes(currentDay)) {
      teacherId = cell.thursSat?.teacherId;
      subject = cell.thursSat?.subject;
    } else if (currentDay === 'SUNDAY') {
      teacherId = cell.extra?.teacherId;
      subject = cell.extra?.subject;
    }

    const teacherObj = teachers.find(t => t.id === teacherId);
    return {
      batch: cell.batch,
      subject: subject || 'N/A',
      teacherName: teacherObj ? teacherObj.fullName : (teacherId ? 'Unknown' : 'Unassigned'),
      teacherId
    };
  };

  const getNextSlot = (slot) => {
    const idx = SLOTS.indexOf(slot);
    return (idx !== -1 && idx < SLOTS.length - 1) ? SLOTS[idx + 1] : null;
  };

  // Rohan's Personal schedule today
  const rohanLecturesToday = [];
  Object.keys(timetable).forEach(slot => {
    Object.keys(timetable[slot] || {}).forEach(room => {
      const cell = timetable[slot][room];
      let assignedTeacherId = null;
      let subject = '';
      if (['MONDAY', 'TUESDAY', 'WEDNESDAY'].includes(currentDay) && cell?.monWed?.teacherId) {
        assignedTeacherId = cell.monWed.teacherId; subject = cell.monWed.subject;
      } else if (['THURSDAY', 'FRIDAY', 'SATURDAY'].includes(currentDay) && cell?.thursSat?.teacherId) {
        assignedTeacherId = cell.thursSat.teacherId; subject = cell.thursSat.subject;
      } else if (currentDay === 'SUNDAY' && cell?.extra?.teacherId) {
        assignedTeacherId = cell.extra.teacherId; subject = cell.extra.subject;
      }
      
      if (assignedTeacherId === rohanId) {
        rohanLecturesToday.push({ slot, room, batch: cell.batch, subject });
      }
    });
  });
  rohanLecturesToday.sort((a, b) => a.slot.localeCompare(b.slot));

  // Legacy todaysClasses layout computed for Deep Analytics
  const todaysClasses = [];
  Object.keys(timetable).forEach(slot => {
    Object.keys(timetable[slot] || {}).forEach(room => {
      const cell = timetable[slot][room];
      let assignedTeacherId = null;
      let subject = '';
      if (['MONDAY', 'TUESDAY', 'WEDNESDAY'].includes(currentDay) && cell?.monWed?.teacherId) {
        assignedTeacherId = cell.monWed.teacherId; subject = cell.monWed.subject;
      } else if (['THURSDAY', 'FRIDAY', 'SATURDAY'].includes(currentDay) && cell?.thursSat?.teacherId) {
        assignedTeacherId = cell.thursSat.teacherId; subject = cell.thursSat.subject;
      } else if (currentDay === 'SUNDAY' && cell?.extra?.teacherId) {
        assignedTeacherId = cell.extra.teacherId; subject = cell.extra.subject;
      }
      if (assignedTeacherId) {
        const teacherName = teachers.find(t => t.id === assignedTeacherId)?.fullName || 'Unknown';
        todaysClasses.push({ slot, room, batch: cell.batch, subject, teacher: teacherName });
      }
    });
  });
  todaysClasses.sort((a, b) => a.slot.localeCompare(b.slot));

  // Attendance Trend (Last 7 Days)
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }).reverse();

  const attendanceTrendData = last7Days.map(dateStr => {
    const records = attendanceLogs.filter(a => a.date === dateStr);
    let absent = 0;
    records.forEach(r => absent += (r.absenteeIds?.length || 0));
    const rate = activeStudentsCount > 0 ? Math.round(((activeStudentsCount - absent) / activeStudentsCount) * 100) : 0;
    return { date: dateStr.substring(5), rate };
  });

  // Workflows
  const drafted = testWorkflows.filter(t => t.status === 'draft_pending' || t.status === 'draft_submitted' || t.status === 'drafted');
  const published = testWorkflows.filter(t => t.status === 'final_published' || t.status === 'published');
  const graded = testWorkflows.filter(t => t.status === 'graded');

  // Leave Requests
  const pendingLeaves = leaveRequests.filter(r => r.status === 'pending');

  const handleApproveLeave = async (reqId) => {
    try {
      await updateDoc(doc(db, 'leave_requests', reqId), {
        status: 'approved',
        reviewedBy: profile?.fullName || profile?.name || 'Rohan Sir (Service Manager)',
        reviewedAt: new Date().toISOString()
      });
      alert("Faculty leave request approved.");
    } catch (err) {
      alert("Error approving leave: " + err.message);
    }
  };

  const handleRejectLeave = async (reqId) => {
    const remark = prompt("Enter rejection note/reason (optional):");
    if (remark === null) return; // User cancelled
    try {
      await updateDoc(doc(db, 'leave_requests', reqId), {
        status: 'rejected',
        reviewRemarks: remark.trim() || 'Declined by Academic Manager',
        reviewedBy: profile?.fullName || profile?.name || 'Rohan Sir (Service Manager)',
        reviewedAt: new Date().toISOString()
      });
      alert("Faculty leave request rejected.");
    } catch (err) {
      alert("Error rejecting leave: " + err.message);
    }
  };

  const handleResolvePTM = async (studentId, createdAt, teacherId) => {
    try {
      const studentRef = doc(db, 'students', studentId);
      const sSnap = await getDoc(studentRef);
      if (!sSnap.exists()) return;
      const sData = sSnap.data();
      const updatedNotices = (sData.ptmNotices || []).map(p => {
        if (p.createdAt === createdAt && p.teacherId === teacherId) {
          return { ...p, status: 'resolved' };
        }
        return p;
      });
      await updateDoc(studentRef, { ptmNotices: updatedNotices });
      alert("PTM successfully resolved.");
    } catch (err) {
      alert("Error resolving PTM: " + err.message);
    }
  };

  const flaggedStudents = students.filter(s => s.redFlag === true);

  const escalatedPTMs = [];
  students.forEach(s => {
    if (s.ptmNotices && Array.isArray(s.ptmNotices)) {
      s.ptmNotices.forEach(ptm => {
        if (ptm.requiresManager && ptm.status === 'pending') {
          escalatedPTMs.push({ ...ptm, studentName: s.studentName || s.fullName, studentId: s.id, batch: s.batch });
        }
      });
    }
  });
  escalatedPTMs.sort((a,b) => new Date(a.dateScheduled) - new Date(b.dateScheduled));

  // Chart Data: Teacher Performance Trend
  const allPerformanceSnapshots = [];
  teachers.forEach(t => {
    if (t.performanceHistory) {
      t.performanceHistory.forEach(ph => {
        const d = new Date(ph.date);
        const dateStr = `${d.getDate()}/${d.getMonth()+1}`; 
        allPerformanceSnapshots.push({ sortDate: d.getTime(), date: dateStr, score: ph.score });
      });
    }
  });
  const groupedPerformance = allPerformanceSnapshots.reduce((acc, curr) => {
    if (!acc[curr.date]) acc[curr.date] = { date: curr.date, sortDate: curr.sortDate, total: 0, count: 0 };
    acc[curr.date].total += curr.score;
    acc[curr.date].count += 1;
    return acc;
  }, {});
  const performanceTrendData = Object.values(groupedPerformance)
    .map(g => ({ date: g.date, avgScore: Math.round(g.total / g.count), sortDate: g.sortDate }))
    .sort((a,b) => a.sortDate - b.sortDate)
    .slice(-10);

  // Operational Alerts calculation
  const allSyllabusBatches = Object.values(
    syllabusProgress.reduce((acc, curr) => {
      if (!acc[curr.batch]) acc[curr.batch] = { name: curr.batch, total: 0, count: 0 };
      acc[curr.batch].total += Number(curr.progress || 0);
      acc[curr.batch].count += 1;
      return acc;
    }, {})
  ).map(b => ({ name: b.name, avgProgress: Math.round(b.total / b.count) }));

  const systemAlerts = [];
  allSyllabusBatches.forEach(b => {
    if (b.avgProgress < 40) {
      systemAlerts.push({
        type: 'syllabus',
        message: `Batch "${b.name}" has critically low syllabus completion (${b.avgProgress}%).`,
        badge: 'Syllabus Delay'
      });
    }
  });

  if (attendanceRate > 0 && attendanceRate < 75) {
    systemAlerts.push({
      type: 'attendance',
      message: `Today's student attendance rate is low (${attendanceRate}%).`,
      badge: 'Low Attendance'
    });
  }

  const activeAbsences = teachers.length - presentTeachersCount;
  if (activeAbsences >= 3) {
    systemAlerts.push({
      type: 'workforce',
      message: `High faculty shortage today: ${activeAbsences} teachers are not present.`,
      badge: 'Staff Alert'
    });
  }

  if (activeTab === 'personal_attendance') {
    return <PersonalAttendance profile={profile} />;
  }
  if (activeTab === 'personal_salary') {
    return <PersonalSalary profile={profile} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      
      {/* Dynamic Styling Overrides */}
      <style>{`
        @media (max-width: 992px) {
          .service-top-grid, .service-ops-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .room-pulse-dot {
          width: 8px;
          height: 8px;
          background-color: var(--status-success);
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          animation: pulse-green 1.5s infinite;
        }
        @keyframes pulse-green {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
          }
        }
        .teacher-presence-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid var(--surface-border);
          transition: background-color 0.2s ease;
        }
        .teacher-presence-row:last-child {
          border-bottom: none;
        }
        .slot-btn {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          background: var(--surface-bg);
          border: 1px solid var(--surface-border);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .slot-btn.active {
          background: var(--brand-primary);
          border-color: var(--brand-primary);
          color: #fff;
        }
      `}</style>

      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Academic & Service Operations</h1>
          <p className="page-subtitle">Welcome back, Rohan Sir. Here is your daily operational briefing.</p>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--surface-border)', gap: 24, marginBottom: 8 }}>
        <button 
          onClick={() => setSubTab('overview')} 
          style={{ 
            padding: '12px 4px', 
            background: 'none', 
            fontSize: 15, 
            fontWeight: 600, 
            color: subTab === 'overview' ? 'var(--brand-primary-dark)' : 'var(--text-secondary)',
            borderBottom: subTab === 'overview' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
        >
          Daily Operations
        </button>
        <button 
          onClick={() => setSubTab('analytics')} 
          style={{ 
            padding: '12px 4px', 
            background: 'none', 
            fontSize: 15, 
            fontWeight: 600, 
            color: subTab === 'analytics' ? 'var(--brand-primary-dark)' : 'var(--text-secondary)',
            borderBottom: subTab === 'analytics' ? '3px solid var(--brand-primary)' : '3px solid transparent',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
        >
          Deep Analytics & Feeds
        </button>
      </div>

      {/* OVERVIEW SUBTAB */}
      {subTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* ZONE 1: Global KPIs & My Lectures Today */}
          <div className="service-top-grid" style={{ 
            display: 'grid', 
            gridTemplateColumns: rohanLecturesToday.length > 0 ? '2fr 1fr' : '1fr', 
            gap: 24 
          }}>
            {/* KPI Cards Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: rohanLecturesToday.length > 0 ? 'repeat(auto-fit, minmax(200px, 1fr))' : 'repeat(auto-fit, minmax(220px, 1fr))', 
              gap: 16 
            }}>
              
              {/* Card 1: Present Teachers */}
              <div className="portal-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
                <div style={{ background: '#d1fae5', padding: '12px', borderRadius: '12px', display: 'flex' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#10b981' }}>supervisor_account</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 24, margin: 0, fontWeight: 700 }}>{presentTeachersCount} / {totalTeachersCount}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Teachers Present Today</p>
                </div>
              </div>

              {/* Card 2: Student Attendance */}
              <div className="portal-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
                <div style={{ background: attendanceRate < 85 ? '#fee2e2' : 'rgba(253,180,42,0.15)', padding: '12px', borderRadius: '12px', display: 'flex' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 32, color: attendanceRate < 85 ? '#ef4444' : 'var(--brand-primary)' }}>how_to_reg</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 24, margin: 0, fontWeight: 700 }}>{attendanceRate}%</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Today's Student Attendance</p>
                </div>
              </div>

              {/* Card 3: Unresolved Grievances */}
              <div className="portal-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', cursor: 'pointer' }} onClick={() => navigate('/faculty')}>
                <div style={{ background: '#fee2e2', padding: '12px', borderRadius: '12px', display: 'flex' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#ef4444' }}>warning</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 24, margin: 0, fontWeight: 700 }}>{stats.pendingGrievances}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Pending Grievances</p>
                </div>
              </div>

              {/* Card 4: Active Published Tests */}
              <div className="portal-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
                <div style={{ background: '#dbeafe', padding: '12px', borderRadius: '12px', display: 'flex' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#3b82f6' }}>quiz</span>
                </div>
                <div>
                  <h3 style={{ fontSize: 24, margin: 0, fontWeight: 700 }}>{published.length}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>Active Published Tests</p>
                </div>
              </div>
            </div>

            {/* Rohan's Personal Schedule widget */}
            {rohanLecturesToday.length > 0 && (
              <div className="portal-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '0 0 12px 0', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--brand-primary-dark)' }}>menu_book</span>
                    My Lectures Today (Rohan Sir)
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '110px', overflowY: 'auto' }}>
                    {rohanLecturesToday.map((lect, idx) => (
                      <div key={idx} style={{ background: 'var(--surface-bg)', padding: '6px 10px', borderRadius: '6px', fontSize: 12, border: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>{lect.batch}</strong>
                          <span style={{ marginLeft: 6, color: 'var(--brand-primary-dark)', fontSize: 11 }}>{lect.subject}</span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                          🕒 {lect.slot.split(' ')[0]} | 🏫 {lect.room.split(' ')[0]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, borderTop: '1px solid var(--surface-border)', paddingTop: 8 }}>
                  Today: {currentDay}, {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                </div>
              </div>
            )}
          </div>

          {/* Retention Risk Queue (Red Flags) */}
          {flaggedStudents.length > 0 && (
            <div style={{ background: '#fff1f2', border: '1px solid #fda4af', padding: '16px', borderRadius: '12px' }}>
              <h3 style={{ color: '#be123c', margin: '0 0 12px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#be123c' }}>flag</span>
                Retention Risk Queue (Red Flagged by Teachers)
              </h3>
              <div className="grid-auto-300" style={{ gap: '12px' }}>
                {flaggedStudents.map(student => (
                  <div key={student.id} style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: '#be123c' }}>{student.studentName || student.fullName} ({student.batch})</strong>
                      <span className="badge" style={{ fontSize: 10, background: '#ffe4e6', color: '#be123c' }}>Risk Alert</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Guardian Contact: {student.contactNo || student.phone || 'N/A'}</span>
                    <span style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', borderLeft: '3px solid #fca5a5' }}>
                      {student.redFlagReason || 'No reason provided'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scheduled PTM Escalations */}
          {escalatedPTMs.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '16px', borderRadius: '12px' }}>
              <h3 style={{ color: '#d97706', margin: '0 0 12px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#d97706' }}>groups</span>
                PTM Escalations (Manager Presence Required)
              </h3>
              <div className="grid-auto-300" style={{ gap: '12px' }}>
                {escalatedPTMs.map((ptm, idx) => (
                  <div key={idx} style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #fcd34d', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '13px', color: '#b45309' }}>{ptm.studentName} ({ptm.batch})</strong>
                      <span className="badge" style={{ fontSize: 10, background: '#fef3c7', color: '#b45309' }}>
                        {new Date(ptm.dateScheduled).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Teacher: {ptm.teacherName}</span>
                    <span style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', borderLeft: '3px solid #fcd34d' }}>
                      Reason: {ptm.reason}
                    </span>
                    <button 
                      onClick={() => handleResolvePTM(ptm.studentId, ptm.createdAt, ptm.teacherId)}
                      className="btn btn-sm" 
                      style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: '4px', alignSelf: 'flex-start', marginTop: '6px', fontSize: '11px', cursor: 'pointer', padding: '4px 10px' }}
                    >
                      Resolve Meeting
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ZONE 2: Daily Operations Center */}
          <div className="service-ops-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            
            {/* Classroom Monitor (Kaksh Map) */}
            <div className="portal-card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>layers</span>
                  Kaksh Live Activity Map
                </h2>
                
                {/* Slot Selector */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => setSelectedSlotOverride('auto')}
                    className={`slot-btn ${selectedSlotOverride === 'auto' ? 'active' : ''}`}
                  >
                    Active Now {autoActiveSlot ? `(${autoActiveSlot.split(' ')[0]})` : '(None)'}
                  </button>
                  {SLOTS.map((slot) => (
                    <button 
                      key={slot}
                      onClick={() => setSelectedSlotOverride(slot)}
                      className={`slot-btn ${selectedSlotOverride === slot ? 'active' : ''}`}
                    >
                      {slot.split(' ')[0]} - {slot.split(' TO ')[1].split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Classroom Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                {CLASSROOMS.map((room) => {
                  const lecture = activeSlot ? getClassroomLecture(room, activeSlot) : null;
                  const isLiveNow = selectedSlotOverride === 'auto' && autoActiveSlot && lecture;
                  const nextSlotName = activeSlot ? getNextSlot(activeSlot) : null;
                  const nextLecture = nextSlotName ? getClassroomLecture(room, nextSlotName) : null;

                  return (
                    <div 
                      key={room} 
                      style={{ 
                        background: 'var(--surface-base)', 
                        border: lecture ? '1px solid rgba(253, 180, 42, 0.25)' : '1px solid var(--surface-border)', 
                        borderRadius: '12px', 
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                        minHeight: '130px',
                        boxShadow: lecture ? '0 4px 12px rgba(253, 180, 42, 0.03)' : 'none',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div>
                        {/* Room Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{room}</span>
                          {lecture ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 600, color: 'var(--status-success)' }}>
                              {isLiveNow ? <span className="room-pulse-dot" /> : '●'} {isLiveNow ? 'Live' : 'Scheduled'}
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>● Vacant</span>
                          )}
                        </div>

                        {/* Lecture Details */}
                        {lecture ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{lecture.batch}</span>
                              <span style={{ fontSize: 9, background: 'rgba(253, 180, 42, 0.12)', color: 'var(--brand-primary-dark)', padding: '1px 6px', borderRadius: '10px', fontWeight: 600 }}>
                                {lecture.subject}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                              👨‍🏫 {lecture.teacherName}
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: '4px 0', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Vacant (No lectures scheduled)
                          </div>
                        )}
                      </div>

                      {/* Next Lecture Footer */}
                      {nextLecture && (
                        <div style={{ borderTop: '1px solid var(--surface-border)', paddingTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                          <span style={{ fontWeight: 600 }}>Next: </span>
                          {nextLecture.batch} ({nextLecture.subject.split(' ')[0]})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Teacher Check-in List */}
            <div className="portal-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ fontSize: 16, marginBottom: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>how_to_reg</span>
                Teacher Check-in status
              </h2>

              <div style={{ overflowY: 'auto', maxHeight: '380px', paddingRight: '4px' }}>
                {teachers.length === 0 ? (
                  <div className="empty-state">No active faculty found.</div>
                ) : (
                  teachers.map((teacher) => {
                    const status = getTeacherStatus(teacher.id);
                    return (
                      <div key={teacher.id} className="teacher-presence-row">
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{teacher.fullName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: '140px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{teacher.email}</div>
                        </div>
                        <div>
                          {status.type === 'present' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                              <span className="badge" style={{ background: '#d1fae5', color: '#065f46', fontSize: 10, padding: '2px 8px' }}>
                                Present
                              </span>
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                In: {status.punchIn}
                              </span>
                              {status.status === 'Late' && (
                                <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', fontSize: 8, padding: '1px 4px', zoom: 0.9 }}>
                                  Late Check-in
                                </span>
                              )}
                            </div>
                          ) : status.type === 'leave' ? (
                            <span className="badge" style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, padding: '2px 8px' }}>
                              On Leave
                            </span>
                          ) : (
                            <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', fontSize: 10, padding: '2px 8px' }}>
                              Absent
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Faculty Leave Approvals Tray */}
            <div className="portal-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>flight_takeoff</span>
                  Faculty Leave Approvals
                </h2>
                {pendingLeaves.length > 0 && (
                  <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontSize: 11, fontWeight: 700 }}>
                    {pendingLeaves.length} Pending
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '280px', overflowY: 'auto' }}>
                {pendingLeaves.length === 0 ? (
                  <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    ✓ All faculty leave requests reviewed.
                  </div>
                ) : (
                  pendingLeaves.map(req => (
                    <div key={req.id} style={{ background: 'var(--surface-bg)', border: '1px solid var(--surface-border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{req.teacherName || 'Faculty Member'}</strong>
                          <span style={{ marginLeft: 6, fontSize: 10, background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: 4, textTransform: 'capitalize' }}>
                            {req.type || 'Leave'}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                          {req.totalDays || 1}d
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        📅 {req.startDate} ➔ {req.endDate}
                      </div>
                      {req.reason && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', background: '#fff', padding: '6px 8px', borderRadius: 4, border: '1px solid #f1f5f9' }}>
                          "{req.reason}"
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button
                          onClick={() => handleApproveLeave(req.id)}
                          className="btn btn-sm"
                          style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectLeave(req.id)}
                          className="btn btn-sm"
                          style={{ flex: 1, background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ANALYTICS SUBTAB */}
      {subTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Active Alerts Banner */}
          {systemAlerts.length > 0 ? (
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '16px', borderRadius: '12px' }}>
              <h3 style={{ color: '#b45309', margin: '0 0 10px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#b45309' }}>warning</span>
                System Operational Alerts ({systemAlerts.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {systemAlerts.map((alert, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontSize: 10 }}>{alert.badge}</span>
                      <span style={{ color: 'var(--text-primary)' }}>{alert.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ color: '#15803d', fontSize: 20 }}>check_circle</span>
              <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>All operational systems are stable. No alerts generated.</span>
            </div>
          )}

          {/* Charts Row - Symmetrical 2x2 Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
            
            {/* Chart 1: 7-Day Attendance Trend */}
            <div className="portal-card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: 16, marginBottom: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>ssid_chart</span>
                7-Day Student Attendance Trend
              </h2>
              <div style={{ height: 220, width: '100%' }}>
                <ResponsiveContainer>
                  <AreaChart data={attendanceTrendData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="rate" name="Attendance %" stroke="var(--brand-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorAtt)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Global Teacher Performance */}
            <div className="portal-card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: 16, marginBottom: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: '#8b5cf6' }}>trending_up</span>
                Global Teacher Performance
              </h2>
              <div style={{ height: 220, width: '100%' }}>
                <ResponsiveContainer>
                  <AreaChart data={performanceTrendData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="avgScore" name="Avg Score" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorPerf)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Syllabus Completion */}
            <div className="portal-card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: 16, marginBottom: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: '#10b981' }}>menu_book</span>
                Top 10 Batch Syllabus Completion
              </h2>
              <div style={{ height: 220, width: '100%' }}>
                <ResponsiveContainer>
                  <BarChart data={syllabusData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f5f5f5' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="avgProgress" name="Avg Completion %" radius={[6, 6, 0, 0]}>
                      {syllabusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.avgProgress < 40 ? '#ef4444' : entry.avgProgress > 80 ? '#10b981' : 'var(--brand-primary)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Faculty Workload */}
            <div className="portal-card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: 16, marginBottom: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: '#6366f1' }}>groups</span>
                Faculty Workload (Weekly Lectures)
              </h2>
              <div style={{ height: 220, width: '100%' }}>
                <ResponsiveContainer>
                  <BarChart data={workloadData} layout="vertical" margin={{ top: 0, right: 10, left: -15, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" name="Weekly Lectures" radius={[0, 6, 6, 0]} barSize={16}>
                      {workloadData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index < 3 ? '#6366f1' : '#a5b4fc'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Pipelines and Feeds Row - Symmetrical Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: 24 }}>
            
            {/* Visual Test duty pipeline */}
            <div className="portal-card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: 16, marginBottom: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: 20 }}>account_tree</span>
                Test Duty Pipeline
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                
                {/* Drafted column */}
                <div className="pipeline-column">
                  <div className="pipeline-column-header">
                    <h3 className="pipeline-stage-title" style={{ color: '#6b7280' }}>Drafted</h3>
                    <span className="pipeline-stage-badge" style={{ background: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' }}>{drafted.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: '250px' }}>
                    {drafted.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No tests in draft</div>
                    ) : (
                      drafted.map(t => (
                        <div key={t.id} className="pipeline-item-card" style={{ borderLeft: '3px solid #6b7280' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{t.batch}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t.subject}</div>
                          <span className="badge" style={{ background: '#f3f4f6', color: '#6b7280', fontSize: 8, padding: '1px 6px', marginTop: 6, zoom: 0.9 }}>
                            Reviewing
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Published column */}
                <div className="pipeline-column" style={{ background: 'rgba(34, 197, 94, 0.01)', borderColor: 'rgba(34, 197, 94, 0.12)' }}>
                  <div className="pipeline-column-header">
                    <h3 className="pipeline-stage-title" style={{ color: '#166534' }}>Published</h3>
                    <span className="pipeline-stage-badge" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#166534' }}>{published.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: '250px' }}>
                    {published.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No live tests</div>
                    ) : (
                      published.map(t => (
                        <div key={t.id} className="pipeline-item-card" style={{ borderLeft: '3px solid #10b981' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{t.batch}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t.subject}</div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            {t.finalLink && (
                              <a href={t.finalLink} target="_blank" rel="noreferrer" style={{ fontSize: 9, background: '#dcfce7', padding: '2px 5px', borderRadius: 4, textDecoration: 'none', color: '#166534', fontWeight: 600 }}>Paper ↗</a>
                            )}
                            {t.solutionsLink && (
                              <a href={t.solutionsLink} target="_blank" rel="noreferrer" style={{ fontSize: 9, background: '#dbeafe', padding: '2px 5px', borderRadius: 4, textDecoration: 'none', color: '#1e40af', fontWeight: 600 }}>Sol ↗</a>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Graded column */}
                <div className="pipeline-column" style={{ background: 'rgba(253, 180, 42, 0.01)', borderColor: 'rgba(253, 180, 42, 0.12)' }}>
                  <div className="pipeline-column-header">
                    <h3 className="pipeline-stage-title" style={{ color: '#92400e' }}>Graded</h3>
                    <span className="pipeline-stage-badge" style={{ background: 'rgba(253, 180, 42, 0.1)', color: '#92400e' }}>{graded.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: '250px' }}>
                    {graded.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No graded tests</div>
                    ) : (
                      graded.map(t => (
                        <div key={t.id} className="pipeline-item-card" style={{ borderLeft: '3px solid var(--brand-primary)' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{t.batch}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t.subject}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12, color: '#10b981' }}>check_circle</span>
                            <span style={{ color: '#92400e', fontSize: 9, fontWeight: 700 }}>Graded</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Post-Lecture reports Timeline feed */}
            <div className="portal-card" style={{ padding: '24px' }}>
              <h2 style={{ fontSize: 16, marginBottom: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#10b981' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>description</span>
                Class Timeline Feed (Post-Lecture Reports)
              </h2>
              <div style={{ maxHeight: '310px', overflowY: 'auto', paddingRight: '4px' }}>
                {lectureReports.length === 0 ? (
                  <div className="empty-state">No lecture reports submitted yet.</div>
                ) : (
                  <div className="timeline-container">
                    {lectureReports.slice(0, 10).map((rep) => (
                      <div key={rep.id} className="timeline-item">
                        <div className="timeline-node" />
                        <div className="timeline-card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                            <div>
                              <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{rep.batch}</strong>
                              <span style={{ fontSize: 10, color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '2px 6px', borderRadius: '4px', marginLeft: 8, fontWeight: 600 }}>{rep.subject}</span>
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rep.date} • {rep.teacherName}</span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', marginBottom: 8 }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Topic:</span> {rep.topicTaught} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({rep.amountTaught})</span>
                          </div>
                          <div style={{ fontSize: 12, background: 'var(--surface-bg)', border: '1px solid var(--surface-border)', padding: '6px 10px', borderRadius: 6, color: 'var(--text-secondary)', marginBottom: 8 }}>
                            <strong style={{ color: 'var(--brand-primary-dark)', fontSize: 11 }}>🏠 Homework Assigned:</strong>
                            <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-secondary)' }}>{rep.homework || 'None'}</div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap', gap: 8 }}>
                            <span><strong>Next:</strong> {rep.nextTarget}</span>
                            {rep.remarks && (
                              <span style={{ fontStyle: 'italic', background: 'rgba(253, 180, 42, 0.08)', padding: '2px 6px', borderRadius: 4, color: 'var(--brand-primary-dark)' }}>
                                Note: {rep.remarks}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
