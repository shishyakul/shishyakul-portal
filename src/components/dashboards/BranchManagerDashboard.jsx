import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, onSnapshot, query, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLocation, Link } from 'react-router-dom';
import PersonalAttendance from './shared/PersonalAttendance';
import PersonalSalary from './shared/PersonalSalary';
import { BATCH_DEF } from '../../pages/Batches';
import './BranchManagerDashboard.css';

const DEFAULT_BATCH_CAPACITY = 20;

export default function BranchManagerDashboard({ profile }) {
  const location = useLocation();
  const activeTabHash = location.hash.replace('#', '');

  // Subtab: 'governance' (18-Batch Radar & Approvals) vs 'academics' (Lecture Reports & Feeds)
  const [activeSubtab, setActiveSubtab] = useState('governance');

  // Firestore state
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [lectureReports, setLectureReports] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingPayroll, setSyncingPayroll] = useState(false);

  useEffect(() => {
    // 1. Fetch Users
    async function fetchUsers() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Fetch users error:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();

    // 2. Realtime Students
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => {
      setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Realtime Attendance
    const unsubAtt = onSnapshot(collection(db, 'attendance'), (snap) => {
      setAttendanceLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 4. Realtime Post-Lecture Reports
    const unsubLectures = onSnapshot(collection(db, 'lecture_reports'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setLectureReports(docs);
    });

    // 5. Realtime Leave Requests
    const unsubLeaves = onSnapshot(collection(db, 'leave_requests'), (snap) => {
      setLeaveRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubStudents();
      unsubAtt();
      unsubLectures();
      unsubLeaves();
    };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // 1. Calculations: Revenue & Admissions
  const branchMetrics = useMemo(() => {
    let totalExpected = 0;
    let totalCollected = 0;
    let admittedCount = 0;

    students.forEach(s => {
      if (s.status === 'admitted') {
        admittedCount++;
        if (s.totalFees) {
          totalExpected += Number(s.totalFees);
          const instCount = Number(s.installments) || 1;
          const instAmount = s.totalFees / instCount;
          const paidCount = (s.paidInstallments || []).length;
          totalCollected += (instAmount * paidCount);
        }
      }
    });

    totalExpected = Math.round(totalExpected);
    totalCollected = Math.round(totalCollected);
    const totalPending = Math.max(0, totalExpected - totalCollected);

    // Faculty count
    const facultyCount = users.filter(u => (u.role === 'teacher' || u.role === 'faculty') && u.isActive !== false).length;

    // Center Attendance Rate
    let totalPresenceRecords = 0;
    let totalAttSessions = attendanceLogs.length;
    let totalPossibleMarks = 0;
    let totalPresentMarks = 0;

    attendanceLogs.forEach(log => {
      const absCount = (log.absenteeIds || []).length;
      const presCount = log.presentCount !== undefined ? log.presentCount : Math.max(0, DEFAULT_BATCH_CAPACITY - absCount);
      totalPresentMarks += presCount;
      totalPossibleMarks += (presCount + absCount);
    });

    const centerAttendanceRate = totalPossibleMarks > 0 ? Math.round((totalPresentMarks / totalPossibleMarks) * 100) : 92;

    return { totalExpected, totalCollected, totalPending, admittedCount, facultyCount, centerAttendanceRate };
  }, [students, users, attendanceLogs]);

  // 2. 18-Batch Capacity & Occupancy Radar
  const batchRadar = useMemo(() => {
    const admittedStudents = students.filter(s => s.status === 'admitted');
    const countsByBatch = {};
    admittedStudents.forEach(s => {
      if (s.batch) {
        countsByBatch[s.batch] = (countsByBatch[s.batch] || 0) + 1;
      }
    });

    const categories = {
      '8th Grade': (BATCH_DEF['8th'] || []).map(b => ({
        id: b.id,
        title: b.title,
        enrolled: countsByBatch[b.id] || 0,
        capacity: DEFAULT_BATCH_CAPACITY,
        occupancyRate: Math.min(100, Math.round(((countsByBatch[b.id] || 0) / DEFAULT_BATCH_CAPACITY) * 100))
      })),
      '9th Grade': (BATCH_DEF['9th'] || []).map(b => ({
        id: b.id,
        title: b.title,
        enrolled: countsByBatch[b.id] || 0,
        capacity: DEFAULT_BATCH_CAPACITY,
        occupancyRate: Math.min(100, Math.round(((countsByBatch[b.id] || 0) / DEFAULT_BATCH_CAPACITY) * 100))
      })),
      '10th Grade': (BATCH_DEF['10th'] || []).map(b => ({
        id: b.id,
        title: b.title,
        enrolled: countsByBatch[b.id] || 0,
        capacity: DEFAULT_BATCH_CAPACITY,
        occupancyRate: Math.min(100, Math.round(((countsByBatch[b.id] || 0) / DEFAULT_BATCH_CAPACITY) * 100))
      }))
    };

    return categories;
  }, [students]);

  // 3. Faculty Leave Approvals & PTM Escalations
  const pendingLeaves = useMemo(() => leaveRequests.filter(r => r.status === 'pending'), [leaveRequests]);

  const escalatedPTMs = useMemo(() => {
    const list = [];
    students.forEach(s => {
      if (s.ptmNotices && Array.isArray(s.ptmNotices)) {
        s.ptmNotices.forEach(ptm => {
          if (ptm.requiresManager && ptm.status === 'pending') {
            list.push({ ...ptm, studentName: s.studentName || s.fullName, studentId: s.id, batch: s.batch });
          }
        });
      }
    });
    return list;
  }, [students]);

  // 4. Truancy & Retention Risk
  const consecutiveAbsentees = useMemo(() => {
    const attendanceByBatch = {};
    attendanceLogs.forEach(log => {
      if (!attendanceByBatch[log.batch]) attendanceByBatch[log.batch] = [];
      attendanceByBatch[log.batch].push(log);
    });
    Object.keys(attendanceByBatch).forEach(batch => {
      attendanceByBatch[batch].sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    const list = [];
    students.filter(s => s.status === 'admitted').forEach(student => {
      const batchLogs = attendanceByBatch[student.batch] || [];
      if (batchLogs.length >= 2) {
        if (batchLogs[0].absenteeIds?.includes(student.id) && batchLogs[1].absenteeIds?.includes(student.id)) {
          list.push({
            ...student,
            fullName: student.studentName || student.fullName,
            lastAbsentDate: batchLogs[0].date
          });
        }
      }
    });
    return list;
  }, [attendanceLogs, students]);

  const flaggedStudents = useMemo(() => students.filter(s => s.redFlag === true), [students]);

  // Actions
  const handleApproveLeave = async (reqId) => {
    try {
      await updateDoc(doc(db, 'leave_requests', reqId), {
        status: 'approved',
        reviewedBy: profile?.fullName || profile?.name || 'Sumit Sir (Branch Manager)',
        reviewedAt: new Date().toISOString()
      });
      alert("Faculty leave request approved successfully.");
    } catch (err) {
      alert("Error approving leave: " + err.message);
    }
  };

  const handleRejectLeave = async (reqId) => {
    const remark = prompt("Enter manager decline note/reason (optional):");
    if (remark === null) return;
    try {
      await updateDoc(doc(db, 'leave_requests', reqId), {
        status: 'rejected',
        reviewRemarks: remark.trim() || 'Declined by Branch Administration',
        reviewedBy: profile?.fullName || profile?.name || 'Sumit Sir (Branch Manager)',
        reviewedAt: new Date().toISOString()
      });
      alert("Faculty leave request declined.");
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
      alert("PTM escalation marked as resolved.");
    } catch (err) {
      alert("Error resolving PTM: " + err.message);
    }
  };

  const handleSyncPayroll = async () => {
    setSyncingPayroll(true);
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const teachers = users.filter(u => u.role === 'teacher' || u.role === 'faculty');
      
      const attSnap = await getDocs(collection(db, 'teacher_attendance'));
      const attData = attSnap.docs.map(d => d.data());

      const payrollData = teachers.map(teacher => {
        const teacherAtt = attData.filter(a => a.userId === teacher.id && a.date?.startsWith(currentMonth));
        const daysPresent = teacherAtt.filter(a => a.status === 'Present').length;
        const teacherLectures = lectureReports.filter(l => l.teacherId === teacher.id);
        const lecturesDeliveredThisMonth = teacherLectures.filter(l => {
          const dateStr = l.date || (l.timestamp && new Date(l.timestamp.seconds * 1000).toISOString().split('T')[0]);
          return dateStr?.startsWith(currentMonth);
        }).length;

        return {
          teacherId: teacher.id,
          teacherName: teacher.fullName,
          month: currentMonth,
          daysPresent,
          lecturesDelivered: lecturesDeliveredThisMonth,
          syncedAt: new Date().toISOString()
        };
      });

      for (const record of payrollData) {
        await setDoc(doc(db, 'core_payroll_timesheets', `${record.teacherId}_${currentMonth}`), record);

        // Bridge directly into salary_history for Teacher Vault
        const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const teacherUser = teachers.find(t => t.id === record.teacherId);
        const baseSalary = Number(teacherUser?.baseSalary || 35000);
        const deductions = Number(teacherUser?.deductions || 0);
        const allowances = Number(teacherUser?.allowances || (teacherUser?.classTeacherBatch ? 3000 : 0));
        const bonus = Number(teacherUser?.bonus || 0);
        const netSalary = baseSalary + allowances + bonus - deductions;

        await setDoc(doc(db, 'salary_history', `${record.teacherId}_${currentMonth}`), {
          teacherId: record.teacherId,
          teacherName: record.teacherName,
          month: monthName,
          monthCode: currentMonth,
          gross: baseSalary + allowances + bonus,
          basePay: baseSalary,
          allowances,
          bonus,
          deductions,
          net: netSalary,
          status: 'Credited',
          paidOn: now.toISOString().split('T')[0],
          syncedAt: new Date().toISOString()
        }, { merge: true });
      }

      alert(`Successfully bridged payroll timesheets and monthly salary vault for ${payrollData.length} faculty members to Core!`);
    } catch (err) {
      alert("Payroll Sync Error: " + err.message);
    } finally {
      setSyncingPayroll(false);
    }
  };

  // Support for personal tabs
  if (activeTabHash === 'personal_attendance') {
    return <PersonalAttendance profile={profile} />;
  }
  if (activeTabHash === 'personal_salary') {
    return <PersonalSalary profile={profile} />;
  }

  return (
    <div className="bmd-container">
      {/* ── 1. Operations Command Header ── */}
      <div className="bmd-header-card">
        <div className="bmd-header-left">
          <div className="bmd-header-badge-row">
            <span className="bmd-badge-live">
              <span className="bmd-live-dot" /> Branch Operations Command
            </span>
            <span className="bmd-badge-role">Branch Manager • Sumit Sir</span>
          </div>
          <h1 className="bmd-header-title">
            {greeting}, <span style={{ color: '#2563eb' }}>{profile?.fullName?.split(' ')[0] || 'Sumit Sir'}</span> 🏢
          </h1>
          <p className="bmd-header-subtitle">
            Executive Control Room • 18-Batch Capacity Radar, Faculty Governance & Timetable Operations
          </p>
        </div>

        <div className="bmd-header-actions">
          <Link to="/users" className="bmd-btn bmd-btn-primary">
            <span className="material-symbols-outlined">group</span>
            Manage Teachers
          </Link>
          <Link to="/batches" className="bmd-btn bmd-btn-ghost">
            <span className="material-symbols-outlined">view_kanban</span>
            Batch Allocation
          </Link>
        </div>
      </div>

      {/* ── 2. Top Bento Overview Cards (Clickable) ── */}
      <div className="bmd-kpi-grid">
        <Link to="/admissions" className="bmd-kpi-card" title="View Admissions & Revenue Pipeline">
          <div className="bmd-kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>payments</span>
          </div>
          <div className="bmd-kpi-info">
            <span className="bmd-kpi-label">Branch Revenue Collected</span>
            <span className="bmd-kpi-value" style={{ color: '#059669' }}>₹{branchMetrics.totalCollected.toLocaleString()}</span>
            <span className="bmd-kpi-sub">Pending: ₹{branchMetrics.totalPending.toLocaleString()}</span>
          </div>
          <span className="material-symbols-outlined bmd-kpi-arrow">chevron_right</span>
        </Link>

        <Link to="/attendance" className="bmd-kpi-card" title="View Center Attendance Matrix">
          <div className="bmd-kpi-icon-wrap" style={{ background: 'rgba(37, 99, 235, 0.12)', color: '#1d4ed8' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>event_available</span>
          </div>
          <div className="bmd-kpi-info">
            <span className="bmd-kpi-label">Center Attendance Rate</span>
            <span className="bmd-kpi-value" style={{ color: '#1d4ed8' }}>{branchMetrics.centerAttendanceRate}%</span>
            <span className="bmd-kpi-sub">Across all scheduled sessions</span>
          </div>
          <span className="material-symbols-outlined bmd-kpi-arrow">chevron_right</span>
        </Link>

        <Link to="/batches" className="bmd-kpi-card" title="View 18-Batch Allocation">
          <div className="bmd-kpi-icon-wrap" style={{ background: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>domain</span>
          </div>
          <div className="bmd-kpi-info">
            <span className="bmd-kpi-label">18-Batch Enrolled</span>
            <span className="bmd-kpi-value">{branchMetrics.admittedCount}</span>
            <span className="bmd-kpi-sub">Active admitted students</span>
          </div>
          <span className="material-symbols-outlined bmd-kpi-arrow">chevron_right</span>
        </Link>

        <Link to="/users" className="bmd-kpi-card" title="Manage Faculty & Staff Roster">
          <div className="bmd-kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>badge</span>
          </div>
          <div className="bmd-kpi-info">
            <span className="bmd-kpi-label">Active Faculty</span>
            <span className="bmd-kpi-value">{branchMetrics.facultyCount}</span>
            <span className="bmd-kpi-sub">{pendingLeaves.length} leave requests pending</span>
          </div>
          <span className="material-symbols-outlined bmd-kpi-arrow">chevron_right</span>
        </Link>
      </div>

      {/* ── 3. Executive Bento Quick Launchers ── */}
      <div className="bmd-launchers-grid">
        <Link to="/users" className="bmd-launcher-card">
          <div className="bmd-launcher-icon" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            <span className="material-symbols-outlined">group</span>
          </div>
          <div>
            <div className="bmd-launcher-title">Manage Teachers</div>
            <div className="bmd-launcher-desc">Profiles, salaries & yearly targets</div>
          </div>
        </Link>

        <Link to="/batches" className="bmd-launcher-card">
          <div className="bmd-launcher-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <span className="material-symbols-outlined">view_kanban</span>
          </div>
          <div>
            <div className="bmd-launcher-title">Batch Allocation</div>
            <div className="bmd-launcher-desc">18-Batch drag & drop matrix</div>
          </div>
        </Link>

        <Link to="/attendance" className="bmd-launcher-card">
          <div className="bmd-launcher-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <span className="material-symbols-outlined">how_to_reg</span>
          </div>
          <div>
            <div className="bmd-launcher-title">Attendance Matrix</div>
            <div className="bmd-launcher-desc">Daily sessions & calling logs</div>
          </div>
        </Link>

        <Link to="/students" className="bmd-launcher-card">
          <div className="bmd-launcher-icon" style={{ background: '#fffbeb', color: '#d97706' }}>
            <span className="material-symbols-outlined">school</span>
          </div>
          <div>
            <div className="bmd-launcher-title">Students 360° Directory</div>
            <div className="bmd-launcher-desc">Academic & portfolio records</div>
          </div>
        </Link>
      </div>

      {/* ── 4. Subtab Switcher Bar ── */}
      <div className="bmd-tabs-bar">
        <button
          className={`bmd-tab-btn ${activeSubtab === 'governance' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('governance')}
        >
          <span className="material-symbols-outlined">tune</span>
          Branch Floor & Governance
          <span className="bmd-tab-pill">{pendingLeaves.length + escalatedPTMs.length} Alerts</span>
        </button>

        <button
          className={`bmd-tab-btn ${activeSubtab === 'academics' ? 'active' : ''}`}
          onClick={() => setActiveSubtab('academics')}
        >
          <span className="material-symbols-outlined">menu_book</span>
          Academic Delivery & Post-Lecture Feeds
          <span className="bmd-tab-pill">{lectureReports.length} Reports</span>
        </button>
      </div>

      {/* ── 5. SUBTAB 1: Branch Floor & Governance ── */}
      {activeSubtab === 'governance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* A. Critical Alert Banners */}
          {consecutiveAbsentees.length > 0 && (
            <div className="bmd-alert-banner truancy">
              <h3 className="bmd-alert-title" style={{ color: '#dc2626' }}>
                <span className="material-symbols-outlined">warning</span>
                Critical Truancy Alert: 2-Day Consecutive Absentees ({consecutiveAbsentees.length})
              </h3>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {consecutiveAbsentees.map(s => (
                  <div key={s.id} style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                    <strong style={{ color: '#dc2626' }}>{s.fullName}</strong> ({s.batch}) • Last absent: {s.lastAbsentDate}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B. Scheduled PTM Escalations */}
          {escalatedPTMs.length > 0 && (
            <div className="bmd-alert-banner ptm">
              <h3 className="bmd-alert-title" style={{ color: '#d97706' }}>
                <span className="material-symbols-outlined">groups</span>
                Scheduled PTM Escalations (Branch Manager Presence Required)
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {escalatedPTMs.map((ptm, idx) => (
                  <div key={idx} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13, color: '#d97706' }}>{ptm.studentName} ({ptm.batch})</strong>
                      <span className="bmd-badge bmd-badge-amber">{new Date(ptm.dateScheduled).toLocaleDateString()}</span>
                    </div>
                    <span style={{ fontSize: 12, color: '#64748b' }}>Teacher: {ptm.teacherName}</span>
                    <span style={{ fontSize: 12, color: '#334155', fontStyle: 'italic', background: '#f8fafc', padding: 6, borderRadius: 4 }}>
                      "{ptm.reason}"
                    </span>
                    <button
                      onClick={() => handleResolvePTM(ptm.studentId, ptm.createdAt, ptm.teacherId)}
                      className="bmd-btn bmd-btn-primary"
                      style={{ padding: '6px 12px', fontSize: 11, alignSelf: 'flex-start', marginTop: 4 }}
                    >
                      Mark Resolved
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* C. Faculty Leave Approvals Desk */}
          <div className="bmd-card">
            <div className="bmd-card-header">
              <div>
                <h2 className="bmd-card-title">
                  <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>flight_takeoff</span>
                  Faculty Leave Approvals Terminal
                </h2>
                <p className="bmd-card-desc">
                  Approve or decline teacher leave applications. Approved leaves automatically set teacher presence to On Leave.
                </p>
              </div>
              <span className="bmd-badge bmd-badge-amber">
                {pendingLeaves.length} Awaiting Manager Action
              </span>
            </div>

            <div className="bmd-card-body">
              {pendingLeaves.length === 0 ? (
                <div className="bmd-empty-state" style={{ padding: '24px 0' }}>
                  <span className="material-symbols-outlined bmd-empty-icon" style={{ color: '#10b981' }}>verified</span>
                  <p style={{ color: '#059669', fontWeight: 600 }}>All faculty leave applications are up to date.</p>
                </div>
              ) : (
                <div className="bmd-leave-grid">
                  {pendingLeaves.map(req => (
                    <div key={req.id} className="bmd-leave-card">
                      <div className="bmd-leave-top">
                        <div>
                          <strong style={{ fontSize: 14, color: '#0f172a' }}>{req.teacherName || 'Faculty Member'}</strong>
                          <span style={{ marginLeft: 6, fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: 4 }}>
                            {req.type || 'Leave'}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>
                          {req.totalDays || 1} Days
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        📅 {req.startDate} to {req.endDate}
                      </div>
                      {req.reason && (
                        <div style={{ fontSize: 12, color: '#334155', fontStyle: 'italic', background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                          "{req.reason}"
                        </div>
                      )}
                      <div className="bmd-leave-actions">
                        <button
                          onClick={() => handleApproveLeave(req.id)}
                          className="bmd-btn"
                          style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '6px 0', fontSize: 12, fontWeight: 700, borderRadius: 6 }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectLeave(req.id)}
                          className="bmd-btn"
                          style={{ flex: 1, background: '#fee2e2', color: '#991b1b', border: 'none', padding: '6px 0', fontSize: 12, fontWeight: 700, borderRadius: 6 }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* D. 18-Batch Capacity Radar */}
          <div className="bmd-card">
            <div className="bmd-card-header">
              <div>
                <h2 className="bmd-card-title">
                  <span className="material-symbols-outlined" style={{ color: '#2563eb' }}>grid_view</span>
                  18-Batch Capacity & Occupancy Radar
                </h2>
                <p className="bmd-card-desc">
                  Live occupancy overview across all 18 batches (8th, 9th, 10th CBSE & State Board).
                </p>
              </div>
              <Link to="/batches" className="bmd-btn bmd-btn-ghost" style={{ fontSize: 12 }}>
                Open Batch Allocator →
              </Link>
            </div>

            <div className="bmd-card-body">
              {Object.entries(batchRadar).map(([gradeName, batches]) => (
                <div key={gradeName} className="bmd-grade-section">
                  <div className="bmd-grade-header">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>school</span>
                    {gradeName} ({batches.length} Batches)
                  </div>
                  <div className="bmd-batch-grid">
                    {batches.map(b => (
                      <div key={b.id} className="bmd-batch-card">
                        <div className="bmd-batch-top">
                          <span className="bmd-batch-name">{b.title}</span>
                          <span className="bmd-batch-badge">{b.enrolled}/{b.capacity}</span>
                        </div>
                        <div className="bmd-batch-progress-bar">
                          <div
                            className="bmd-batch-progress-fill"
                            style={{
                              width: `${b.occupancyRate}%`,
                              background: b.occupancyRate >= 90 ? '#ef4444' : b.occupancyRate >= 70 ? '#f59e0b' : '#3b82f6'
                            }}
                          />
                        </div>
                        <div className="bmd-batch-meta">
                          <span>Occupancy</span>
                          <span style={{ fontWeight: 700 }}>{b.occupancyRate}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 6. SUBTAB 2: Academic Delivery & Post-Lecture Feeds ── */}
      {activeSubtab === 'academics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Realtime Post-Lecture Reports Feed */}
          <div className="bmd-card">
            <div className="bmd-card-header">
              <div>
                <h2 className="bmd-card-title">
                  <span className="material-symbols-outlined" style={{ color: '#10b981' }}>description</span>
                  Classroom Post-Lecture Submissions Feed
                </h2>
                <p className="bmd-card-desc">
                  Real-time lecture reports logged by faculty across all 6 Kaksh halls.
                </p>
              </div>
              <span className="bmd-badge bmd-badge-emerald">
                {lectureReports.length} Total Reports
              </span>
            </div>

            <div className="bmd-card-body" style={{ maxHeight: 480, overflowY: 'auto' }}>
              {lectureReports.length === 0 ? (
                <div className="bmd-empty-state">
                  <span className="material-symbols-outlined bmd-empty-icon">history_edu</span>
                  <p>No post-lecture reports filed today.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                  {lectureReports.slice(0, 12).map(rep => (
                    <div
                      key={rep.id}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderLeft: '4px solid #10b981',
                        borderRadius: 8,
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: 13, color: '#0f172a' }}>{rep.batch} • {rep.subject}</strong>
                        <span style={{ fontSize: 11, color: '#64748b' }}>{rep.date}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
                        👨‍🏫 {rep.teacherName}
                      </div>
                      <div style={{ fontSize: 12, color: '#334155' }}>
                        <strong>Topic:</strong> {rep.topicTaught} ({rep.amountTaught})
                      </div>
                      {rep.homework && (
                        <div style={{ fontSize: 11, background: '#fff', padding: 6, borderRadius: 4, border: '1px solid #e2e8f0' }}>
                          <strong>HW:</strong> {rep.homework}
                        </div>
                      )}
                      {rep.remarks && (
                        <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                          Note: {rep.remarks}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Retention Risk Table */}
          <div className="bmd-card">
            <div className="bmd-card-header">
              <div>
                <h2 className="bmd-card-title">
                  <span className="material-symbols-outlined" style={{ color: '#dc2626' }}>flag</span>
                  Retention Risk Queue (Red Flagged by Teachers)
                </h2>
                <p className="bmd-card-desc">
                  Students identified by subject teachers as high dropout risk.
                </p>
              </div>
            </div>

            <div className="bmd-card-body">
              {flaggedStudents.length === 0 ? (
                <div className="bmd-empty-state" style={{ padding: '24px 0' }}>
                  <span className="material-symbols-outlined bmd-empty-icon" style={{ color: '#10b981' }}>sentiment_satisfied</span>
                  <p style={{ color: '#059669', fontWeight: 600 }}>No students currently red-flagged by faculty.</p>
                </div>
              ) : (
                <div className="bmd-table-wrapper">
                  <table className="bmd-table">
                    <thead>
                      <tr>
                        <th>Student Name</th>
                        <th>Batch</th>
                        <th>Parent Phone</th>
                        <th>Flag Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flaggedStudents.map(s => (
                        <tr key={s.id}>
                          <td><strong style={{ color: '#dc2626' }}>{s.studentName || s.fullName}</strong></td>
                          <td><span className="bmd-badge bmd-badge-amber">{s.batch}</span></td>
                          <td>{s.contactNo || s.fatherContact || 'N/A'}</td>
                          <td style={{ fontStyle: 'italic' }}>{s.redFlagReason || 'Academic struggle'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
