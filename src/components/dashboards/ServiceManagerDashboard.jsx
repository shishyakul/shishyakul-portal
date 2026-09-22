import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import PersonalAttendance from './shared/PersonalAttendance';
import PersonalSalary from './shared/PersonalSalary';
import './ServiceManagerDashboard.css';

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
  const [teacherSearch, setTeacherSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
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
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
        punchIn: attRecord.punchIn || 'Present',
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

  // Filtered teachers list for presence check-in
  const filteredTeachers = teachers.filter(t => {
    if (!teacherSearch.trim()) return true;
    const q = teacherSearch.toLowerCase();
    const name = (t.fullName || '').toLowerCase();
    const email = (t.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

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
    if (remark === null) return;
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

  const formattedDate = currentTime.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const formattedTime = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  if (activeTab === 'personal_attendance') {
    return <PersonalAttendance profile={profile} />;
  }
  if (activeTab === 'personal_salary') {
    return <PersonalSalary profile={profile} />;
  }

  return (
    <div className="sm-container">
      
      {/* ── Top Header Card ── */}
      <div className="sm-header-card">
        <div className="sm-header-left">
          <div className="sm-header-badge-row">
            <span className="sm-badge-live">
              <span className="sm-live-dot"></span>
              Academic Operations Active
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              • Service Management Center
            </span>
          </div>
          <h1 className="sm-header-title">
            Welcome back, <span className="gradient-text">Rohan Sir</span> 👋
          </h1>
          <p className="sm-header-subtitle">
            Kaksh live activity radar, faculty presence, master timetable crafting, and academic KPIs.
          </p>
        </div>

        <div className="sm-header-meta">
          <div className="sm-time-chip">
            <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)', fontSize: 20 }}>
              schedule
            </span>
            <span className="sm-time-clock">{formattedTime}</span>
            <span className="sm-date-text">{formattedDate}</span>
          </div>
        </div>
      </div>

      {/* ── Bento-Grid Action Launchers ── */}
      <div className="sm-bento-grid">
        {/* 1. Crafting Table */}
        <div 
          className="sm-action-tile sm-tile-gold"
          onClick={() => navigate('/faculty')}
        >
          <div className="sm-tile-top">
            <div className="sm-tile-icon-box" style={{ background: 'rgba(253, 180, 42, 0.12)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary-dark)', fontSize: 24 }}>
                architecture
              </span>
            </div>
            <span className="sm-tile-badge" style={{ background: 'rgba(253, 180, 42, 0.15)', color: 'var(--brand-primary-dark)' }}>
              Crafting Table
            </span>
          </div>
          <div>
            <h3 className="sm-tile-title">Master Timetable</h3>
            <p className="sm-tile-desc">Assign slots, classrooms, and subject faculty mapping</p>
          </div>
        </div>

        {/* 2. Faculty Directory */}
        <div 
          className="sm-action-tile sm-tile-indigo"
          onClick={() => navigate('/users')}
        >
          <div className="sm-tile-top">
            <div className="sm-tile-icon-box" style={{ background: 'rgba(99, 102, 241, 0.12)' }}>
              <span className="material-symbols-outlined" style={{ color: '#6366f1', fontSize: 24 }}>
                groups
              </span>
            </div>
            <span className="sm-tile-badge" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
              {teachers.length} Teachers
            </span>
          </div>
          <div>
            <h3 className="sm-tile-title">Faculty Roster</h3>
            <p className="sm-tile-desc">Manage teachers, batches, and subject qualifications</p>
          </div>
        </div>

        {/* 3. Daily Attendance */}
        <div 
          className="sm-action-tile sm-tile-emerald"
          onClick={() => navigate('/attendance')}
        >
          <div className="sm-tile-top">
            <div className="sm-tile-icon-box" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
              <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 24 }}>
                fact_check
              </span>
            </div>
            <span className="sm-tile-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              {attendanceRate}% Present
            </span>
          </div>
          <div>
            <h3 className="sm-tile-title">Batch Attendance</h3>
            <p className="sm-tile-desc">Inspect daily student sessions and absentee trends</p>
          </div>
        </div>

        {/* 4. Student Directory */}
        <div 
          className="sm-action-tile sm-tile-rose"
          onClick={() => navigate('/students')}
        >
          <div className="sm-tile-top">
            <div className="sm-tile-icon-box" style={{ background: 'rgba(244, 63, 94, 0.12)' }}>
              <span className="material-symbols-outlined" style={{ color: '#f43f5e', fontSize: 24 }}>
                school
              </span>
            </div>
            <span className="sm-tile-badge" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
              {activeStudentsCount} Admitted
            </span>
          </div>
          <div>
            <h3 className="sm-tile-title">Academic Directory</h3>
            <p className="sm-tile-desc">Student records, batches, performance, and parent logs</p>
          </div>
        </div>
      </div>

      {/* ── Segmented Sub-Tab Switcher ── */}
      <div className="sm-tab-bar">
        <button 
          onClick={() => setSubTab('overview')} 
          className={`sm-tab-btn ${subTab === 'overview' ? 'active' : ''}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dashboard</span>
          Daily Operations Hub
        </button>
        <button 
          onClick={() => setSubTab('analytics')} 
          className={`sm-tab-btn ${subTab === 'analytics' ? 'active' : ''}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>analytics</span>
          Academic Intelligence & Feeds
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SUBTAB 1: DAILY OPERATIONS HUB
          ══════════════════════════════════════════════════════════════════════ */}
      {subTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Primary KPI Strip */}
          <div className="sm-kpi-grid">
            {/* KPI 1: Teachers Present */}
            <div className="sm-kpi-card">
              <div className="sm-kpi-icon-box" style={{ background: 'rgba(16, 185, 129, 0.12)' }}>
                <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 26 }}>supervisor_account</span>
              </div>
              <div>
                <div className="sm-kpi-value">{presentTeachersCount} / {totalTeachersCount}</div>
                <div className="sm-kpi-label">Teachers Present Today</div>
              </div>
            </div>

            {/* KPI 2: Student Attendance */}
            <div className="sm-kpi-card">
              <div className="sm-kpi-icon-box" style={{ background: attendanceRate < 75 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(253, 180, 42, 0.15)' }}>
                <span className="material-symbols-outlined" style={{ color: attendanceRate < 75 ? '#ef4444' : 'var(--brand-primary-dark)', fontSize: 26 }}>how_to_reg</span>
              </div>
              <div>
                <div className="sm-kpi-value">{attendanceRate}%</div>
                <div className="sm-kpi-label">Student Attendance</div>
              </div>
            </div>

            {/* KPI 3: Pending Grievances */}
            <div className="sm-kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/faculty')}>
              <div className="sm-kpi-icon-box" style={{ background: stats.pendingGrievances > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)' }}>
                <span className="material-symbols-outlined" style={{ color: stats.pendingGrievances > 0 ? '#ef4444' : '#10b981', fontSize: 26 }}>
                  {stats.pendingGrievances > 0 ? 'warning' : 'verified'}
                </span>
              </div>
              <div>
                <div className="sm-kpi-value">{stats.pendingGrievances}</div>
                <div className="sm-kpi-label">Pending Grievances</div>
              </div>
            </div>

            {/* KPI 4: Published Tests */}
            <div className="sm-kpi-card">
              <div className="sm-kpi-icon-box" style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
                <span className="material-symbols-outlined" style={{ color: '#3b82f6', fontSize: 26 }}>quiz</span>
              </div>
              <div>
                <div className="sm-kpi-value">{published.length}</div>
                <div className="sm-kpi-label">Active Published Tests</div>
              </div>
            </div>
          </div>

          {/* Rohan's Personal Schedule (If teaching today) */}
          {rohanLecturesToday.length > 0 && (
            <div className="sm-personal-schedule-card">
              <div className="sm-personal-schedule-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary-dark)', fontSize: 20 }}>
                    menu_book
                  </span>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    My Scheduled Lectures Today (Rohan Sir)
                  </h3>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {currentDay}, {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
                </span>
              </div>

              <div className="sm-personal-lectures-row">
                {rohanLecturesToday.map((lect, idx) => (
                  <div key={idx} className="sm-lecture-chip">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{lect.batch}</strong>
                      <span className="badge badge-branch-manager" style={{ fontSize: 10, padding: '1px 6px' }}>{lect.subject}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                      <span>🕒 {lect.slot.split(' ')[0]}</span>
                      <span>🏫 {lect.room}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Retention Risk Queue (Red Flags by Teachers) */}
          {flaggedStudents.length > 0 && (
            <div style={{ background: '#fff1f2', border: '1px solid #fda4af', padding: '18px 20px', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ color: '#be123c', margin: '0 0 12px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#be123c' }}>flag</span>
                Retention Risk Queue (Teacher Red-Flags)
              </h3>
              <div className="grid-auto-300" style={{ gap: '12px' }}>
                {flaggedStudents.map(student => (
                  <div key={student.id} style={{ background: '#fff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '6px' }}>
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

          {/* Scheduled PTM Escalations (Manager Presence Required) */}
          {escalatedPTMs.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '18px 20px', borderRadius: 'var(--radius-lg)' }}>
              <h3 style={{ color: '#d97706', margin: '0 0 12px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#d97706' }}>groups</span>
                PTM Escalations (Manager Presence Required)
              </h3>
              <div className="grid-auto-300" style={{ gap: '12px' }}>
                {escalatedPTMs.map((ptm, idx) => (
                  <div key={idx} style={{ background: '#fff', padding: '14px', borderRadius: '8px', border: '1px solid #fcd34d', display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                      style={{ background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', alignSelf: 'flex-start', marginTop: '6px', fontSize: '11px', cursor: 'pointer', padding: '5px 12px', fontWeight: 600 }}
                    >
                      Resolve Meeting
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Main Operations Center 2-Column Grid ── */}
          <div className="sm-ops-grid">
            
            {/* Left: Kaksh Live Activity Map (Classroom Radar) */}
            <div className="sm-radar-card">
              <div className="sm-radar-topbar">
                <div>
                  <h2 style={{ fontSize: 17, margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>layers</span>
                    Kaksh Live Activity Map
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                    Live classroom allocation across 6 main halls
                  </p>
                </div>
                
                {/* Segmented Slot Selector */}
                <div className="sm-slot-pill-group">
                  <button 
                    onClick={() => setSelectedSlotOverride('auto')}
                    className={`sm-slot-pill ${selectedSlotOverride === 'auto' ? 'active' : ''}`}
                  >
                    Active Now {autoActiveSlot ? `(${autoActiveSlot.split(' ')[0]})` : ''}
                  </button>
                  {SLOTS.map((slot) => (
                    <button 
                      key={slot}
                      onClick={() => setSelectedSlotOverride(slot)}
                      className={`sm-slot-pill ${selectedSlotOverride === slot ? 'active' : ''}`}
                    >
                      {slot.split(' ')[0]} - {slot.split(' TO ')[1].split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Classroom Radar Grid */}
              <div className="sm-radar-grid">
                {CLASSROOMS.map((room) => {
                  const lecture = activeSlot ? getClassroomLecture(room, activeSlot) : null;
                  const isLiveNow = selectedSlotOverride === 'auto' && autoActiveSlot && lecture;
                  const nextSlotName = activeSlot ? getNextSlot(activeSlot) : null;
                  const nextLecture = nextSlotName ? getClassroomLecture(room, nextSlotName) : null;

                  return (
                    <div 
                      key={room} 
                      className={`sm-room-card ${isLiveNow ? 'live-now' : lecture ? 'scheduled' : 'vacant'}`}
                    >
                      <div>
                        {/* Room Header */}
                        <div className="sm-room-header">
                          <span className="sm-room-code">{room}</span>
                          {lecture ? (
                            <span className="sm-room-badge-live">
                              {isLiveNow && <span className="sm-live-dot" />}
                              {isLiveNow ? 'Live Session' : 'Scheduled'}
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>
                              Vacant
                            </span>
                          )}
                        </div>

                        {/* Lecture Details */}
                        {lecture ? (
                          <div style={{ marginTop: 6 }}>
                            <div className="sm-room-batch">{lecture.batch}</div>
                            <span className="sm-room-subject">{lecture.subject}</span>
                            <div className="sm-room-teacher">
                              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>person</span>
                              <span>{lecture.teacherName}</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Hall free for study or makeup tests
                          </div>
                        )}
                      </div>

                      {/* Next Lecture Footer */}
                      {nextLecture && (
                        <div className="sm-room-next-footer">
                          <strong>Next:</strong> {nextLecture.batch} ({nextLecture.subject.split(' ')[0]})
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Workforce Presence & Headcount Hub */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Teacher Check-in List */}
              <div className="sm-presence-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h2 style={{ fontSize: 16, margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>how_to_reg</span>
                    Teacher Check-in Status
                  </h2>
                  <span className="badge badge-branch-manager" style={{ fontSize: 11 }}>
                    {presentTeachersCount} / {totalTeachersCount}
                  </span>
                </div>

                {/* Filter Input */}
                <input
                  type="text"
                  placeholder="Search faculty name or email..."
                  className="sm-presence-search"
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                />

                <div className="sm-presence-list">
                  {filteredTeachers.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px 0' }}>No matching teachers found.</div>
                  ) : (
                    filteredTeachers.map((teacher) => {
                      const status = getTeacherStatus(teacher.id);
                      return (
                        <div key={teacher.id} className="sm-presence-item">
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                              {teacher.fullName}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {teacher.assignedBatches?.join(', ') || teacher.subjects?.join(', ') || 'Faculty'}
                            </div>
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
                                  <span className="badge" style={{ background: '#fee2e2', color: '#991b1b', fontSize: 9, padding: '1px 5px' }}>
                                    Late
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
              <div className="sm-leave-tray">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: 15, margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>flight_takeoff</span>
                    Faculty Leave Requests
                  </h2>
                  {pendingLeaves.length > 0 && (
                    <span className="badge" style={{ background: '#fef3c7', color: '#b45309', fontSize: 11, fontWeight: 700 }}>
                      {pendingLeaves.length} Pending
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '280px', overflowY: 'auto' }}>
                  {pendingLeaves.length === 0 ? (
                    <div style={{ padding: '20px 8px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, border: '1px dashed var(--surface-border)', borderRadius: 'var(--radius-md)' }}>
                      <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: 24, display: 'block', marginBottom: 4 }}>verified</span>
                      All faculty leave requests are reviewed.
                    </div>
                  ) : (
                    pendingLeaves.map(req => (
                      <div key={req.id} className="sm-leave-item">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{req.teacherName || 'Faculty Member'}</strong>
                            <span style={{ marginLeft: 6, fontSize: 10, background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: 4, textTransform: 'capitalize' }}>
                              {req.type || 'Leave'}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-primary-dark)' }}>
                            {req.totalDays || 1} Days
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          📅 {req.startDate} to {req.endDate}
                        </div>
                        {req.reason && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontStyle: 'italic', background: '#fff', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--surface-border)' }}>
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

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SUBTAB 2: DEEP ANALYTICS & ACADEMIC FEEDS
          ══════════════════════════════════════════════════════════════════════ */}
      {subTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Active Operational Alerts Banner */}
          {systemAlerts.length > 0 ? (
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '16px 20px', borderRadius: 'var(--radius-lg)' }}>
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
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 18px', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-outlined" style={{ color: '#15803d', fontSize: 20 }}>check_circle</span>
              <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>All academic operational systems are running stably. Zero alerts generated.</span>
            </div>
          )}

          {/* Symmetrical 2x2 Analytics Grid */}
          <div className="sm-analytics-grid">
            
            {/* Chart 1: 7-Day Attendance Trend */}
            <div className="sm-chart-card">
              <h2 style={{ fontSize: 16, marginBottom: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="rate" name="Attendance %" stroke="var(--brand-primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorAtt)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Global Teacher Performance */}
            <div className="sm-chart-card">
              <h2 style={{ fontSize: 16, marginBottom: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="avgScore" name="Avg Score" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorPerf)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Syllabus Completion */}
            <div className="sm-chart-card">
              <h2 style={{ fontSize: 16, marginBottom: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: '#10b981' }}>menu_book</span>
                Top 10 Batch Syllabus Completion
              </h2>
              <div style={{ height: 220, width: '100%' }}>
                <ResponsiveContainer>
                  <BarChart data={syllabusData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'var(--surface-bg)' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
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
            <div className="sm-chart-card">
              <h2 style={{ fontSize: 16, marginBottom: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: '#6366f1' }}>groups</span>
                Faculty Workload (Weekly Lectures)
              </h2>
              <div style={{ height: 220, width: '100%' }}>
                <ResponsiveContainer>
                  <BarChart data={workloadData} layout="vertical" margin={{ top: 0, right: 10, left: -15, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'var(--surface-bg)' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
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

          {/* Pipelines and Feeds 2-Column Grid */}
          <div className="sm-analytics-grid">
            
            {/* Test Duty Pipeline */}
            <div className="sm-chart-card">
              <h2 style={{ fontSize: 16, marginBottom: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: '#f59e0b', fontSize: 20 }}>account_tree</span>
                Saturday Test Duty Pipeline
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                
                {/* Drafted */}
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

                {/* Published */}
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

                {/* Graded */}
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

            {/* Post-Lecture Reports Timeline feed */}
            <div className="sm-chart-card">
              <h2 style={{ fontSize: 16, marginBottom: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: '#10b981' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>description</span>
                Post-Lecture Reports Feed
              </h2>
              <div style={{ maxHeight: '310px', overflowY: 'auto', paddingRight: '4px' }}>
                {lectureReports.length === 0 ? (
                  <div className="empty-state">No lecture reports submitted yet today.</div>
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
