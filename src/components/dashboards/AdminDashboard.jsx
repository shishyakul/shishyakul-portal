import { useState, useEffect } from 'react';
import { collection, getDocs, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import NotificationBell from '../NotificationBell';

const ROLE_COLORS = {
  admin: 'badge-admin',
  branch_manager: 'badge-branch-manager',
  service_manager: 'badge-service-manager',
  front_desk_manager: 'badge-front-desk',
  inventory_manager: 'badge-inventory-manager'
};

const formatRole = (role) => {
  if (!role) return 'Unknown';
  return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export default function AdminDashboard({ profile }) {
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [lectureReports, setLectureReports] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    const q = query(collection(db, 'students'));
    const unsub = onSnapshot(q, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qAtt = query(collection(db, 'attendance'));
    const unsubAtt = onSnapshot(qAtt, (snapshot) => {
      setAttendanceLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubLectureReports = onSnapshot(collection(db, 'lecture_reports'), (snap) => {
      setLectureReports(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
    });

    return () => { unsub(); unsubAtt(); unsubLectureReports(); };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Compute Metrics
  const activeUsers = users.filter(u => u.isActive !== false);
  const recentUsers = activeUsers.slice(0, 5);

  let totalExpected = 0;
  let totalCollected = 0;
  let funnel = { enquiry: 0, demo: 0, admitted: 0, dropped: 0 };

  students.forEach(s => {
    // Funnel
    const status = s.status || 'enquiry';
    if (status === 'enquiry') funnel.enquiry++;
    else if (status === 'demo') funnel.demo++;
    else if (status === 'admitted') funnel.admitted++;
    else if (status === 'dropped') funnel.dropped++;

    // Finances (Only for admitted)
    if (status === 'admitted' && s.totalFees) {
      totalExpected += s.totalFees;
      const instCount = s.installments || 1;
      const instAmount = s.totalFees / instCount;
      const paidCount = (s.paidInstallments || []).length;
      totalCollected += (instAmount * paidCount);
    }
  });

  totalExpected = Math.round(totalExpected);
  totalCollected = Math.round(totalCollected);
  const totalPending = totalExpected - totalCollected;
  const conversionRate = (funnel.enquiry + funnel.demo + funnel.admitted) > 0 
    ? Math.round((funnel.admitted / (funnel.enquiry + funnel.demo + funnel.admitted + funnel.dropped)) * 100) 
    : 0;

  // Group attendance logs by batch and sort by date desc
  const attendanceByBatch = {};
  attendanceLogs.forEach(log => {
    if (!attendanceByBatch[log.batch]) attendanceByBatch[log.batch] = [];
    attendanceByBatch[log.batch].push(log);
  });
  Object.keys(attendanceByBatch).forEach(batch => {
    attendanceByBatch[batch].sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  const consecutiveAbsentees = [];

  // Calculate attendance % for admitted students
  const studentAttendanceStats = students.filter(s => s.status === 'admitted').map(student => {
    const batchLogs = attendanceByBatch[student.batch] || [];
    const totalSessions = batchLogs.length;
    const absentSessions = batchLogs.filter(log => log.absenteeIds?.includes(student.id)).length;
    const presentSessions = totalSessions - absentSessions;
    const percentage = totalSessions === 0 ? 100 : Math.round((presentSessions / totalSessions) * 100);

    // Check for 2 continuous absences in the latest 2 sessions
    if (batchLogs.length >= 2) {
      if (batchLogs[0].absenteeIds?.includes(student.id) && batchLogs[1].absenteeIds?.includes(student.id)) {
        consecutiveAbsentees.push({
          ...student,
          lastAbsentDate: batchLogs[0].date
        });
      }
    }

    return {
      ...student,
      percentage,
      totalSessions,
      absentSessions
    };
  }).sort((a, b) => a.percentage - b.percentage); // Lowest attendance first (Truancy risk)
  
  const truancyList = studentAttendanceStats.slice(0, 5);

  // Chart Data
  const revenueData = [
    { name: 'Collected', value: totalCollected, color: '#4ade80' },
    { name: 'Pending', value: totalPending, color: '#fdb42a' }
  ];

  const funnelData = [
    { name: 'Enquiry', count: funnel.enquiry, fill: '#60a5fa' },
    { name: 'Demo', count: funnel.demo, fill: '#a855f7' },
    { name: 'Admitted', count: funnel.admitted, fill: '#4ade80' },
    { name: 'Dropped', count: funnel.dropped, fill: '#ef4444' }
  ];

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'var(--surface-elevated)', border: '1px solid var(--surface-border)', padding: '8px 12px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{payload[0].name}</p>
          <p style={{ margin: 0, fontSize: '14px', color: payload[0].payload.color || payload[0].payload.fill }}>
            {payload[0].name === 'Collected' || payload[0].name === 'Pending' 
              ? `₹${payload[0].value.toLocaleString()}` 
              : payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting},{' '}
            <span className="gradient-text">
              {profile?.fullName?.split(' ')[0] ?? 'Admin'}
            </span>{' '}
            👋
          </h1>
          <p className="page-subtitle">
            Shishyakul Global Branch Analytics & Overview.
          </p>
        </div>
        <div>
          <NotificationBell />
        </div>
      </div>

      {/* 2-Day Absentee Notification Alert */}
      {consecutiveAbsentees.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '16px', borderRadius: '8px', marginBottom: 28 }}>
          <h3 style={{ color: '#dc2626', margin: '0 0 12px 0', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>warning</span>
            Critical: 2-Day Consecutive Absentees (Follow-up Required)
          </h3>
          <div className="grid-auto-300" style={{ gap: '8px' }}>
            {consecutiveAbsentees.map(student => (
              <div key={student.id} style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '13px', display: 'block', color: '#dc2626' }}>{student.fullName} ({student.batch})</strong>
                  <span style={{ fontSize: '12px', color: '#666' }}>Phone: {student.phone}</span>
                </div>
                <span className="badge badge-admin" style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626' }}>
                  Absent since {student.lastAbsentDate}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary KPI Widgets */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(74, 222, 128, 0.12)' }}>
            <span className="material-symbols-outlined filled" style={{ color: '#4ade80', fontSize: 22 }}>payments</span>
          </div>
          <div className="stat-label">Total Revenue Collected</div>
          <div className="stat-value" style={{ color: '#4ade80' }}>₹{totalCollected.toLocaleString()}</div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(253, 180, 42, 0.12)' }}>
            <span className="material-symbols-outlined filled" style={{ color: '#fdb42a', fontSize: 22 }}>pending_actions</span>
          </div>
          <div className="stat-label">Pending Dues</div>
          <div className="stat-value" style={{ color: '#fdb42a' }}>₹{totalPending.toLocaleString()}</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
            <span className="material-symbols-outlined filled" style={{ color: '#3b82f6', fontSize: 22 }}>groups</span>
          </div>
          <div className="stat-label">Total Students Admitted</div>
          <div className="stat-value">{funnel.admitted}</div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(168, 85, 247, 0.12)' }}>
            <span className="material-symbols-outlined filled" style={{ color: '#a855f7', fontSize: 22 }}>trending_up</span>
          </div>
          <div className="stat-label">Enquiry Conversion Rate</div>
          <div className="stat-value">{conversionRate}%</div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid-2" style={{ marginBottom: 28, alignItems: 'stretch' }}>
        <div className="portal-card" style={{ height: '360px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            Revenue Breakdown
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Expected Total: ₹{totalExpected.toLocaleString()}</p>
          <div style={{ flex: 1, minHeight: 0 }}>
            {totalExpected === 0 ? (
              <div className="empty-state" style={{ height: '100%' }}>No financial data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {revenueData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="portal-card" style={{ height: '360px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            Admissions Pipeline
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Live tracker of the conversion funnel.</p>
          <div style={{ flex: 1, minHeight: 0 }}>
            {students.length === 0 ? (
              <div className="empty-state" style={{ height: '100%' }}>No students in pipeline</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
                  <YAxis hide />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--surface-bg)' }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Post-Lecture Reports Feed */}
      <div className="portal-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
        <div style={{ padding: '16px 20px', background: 'linear-gradient(90deg, var(--surface-bg), rgba(16, 185, 129, 0.05))', borderBottom: '1px solid var(--surface-border)' }}>
          <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8, color: '#10b981' }}>
            <span className="material-symbols-outlined">description</span>
            Recent Post-Lecture Reports
          </h2>
        </div>
        <div style={{ padding: 20, maxHeight: '350px', overflowY: 'auto' }}>
          {lectureReports.length === 0 ? (
            <div className="empty-state">No lecture reports submitted yet.</div>
          ) : (
            <div className="grid-auto-300">
              {lectureReports.slice(0, 10).map((rep) => (
                <div key={rep.id} style={{ background: 'var(--surface-bg)', padding: 16, borderRadius: 8, borderLeft: '4px solid #10b981', borderTop: '1px solid var(--surface-border)', borderRight: '1px solid var(--surface-border)', borderBottom: '1px solid var(--surface-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{rep.batch} <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>| {rep.subject}</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rep.date}</div>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>
                    👨‍🏫 {rep.teacherName}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>
                    <strong>Topic:</strong> {rep.topicTaught} <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>({rep.amountTaught})</span>
                  </div>
                  <div style={{ fontSize: 13, background: '#f9fafb', padding: 8, borderRadius: 4, marginBottom: 8 }}>
                    <strong>Homework:</strong> {rep.homework}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span><strong>Next:</strong> {rep.nextTarget}</span>
                  </div>
                  {rep.remarks && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>Note: {rep.remarks}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lower Section: Staff & Actions */}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        
        {/* Attendance Truancy Risk */}
        <div className="portal-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
              Attendance Risk (Truancy)
            </h2>
            <a href="/attendance" style={{ fontSize: 13, color: 'var(--brand-primary)', fontWeight: 600 }}>
              View logs →
            </a>
          </div>

          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : truancyList.length === 0 ? (
            <div className="empty-state">
              <span className="material-symbols-outlined">how_to_reg</span>
              <p>No admitted students or attendance data found.</p>
            </div>
          ) : (
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Batch</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {truancyList.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                        {s.studentName || 'Unknown'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {s.contactNo || s.fatherContact || 'No contact'}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-branch-manager">
                        {s.batch || 'Pending'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: s.percentage < 75 ? 'var(--status-error)' : 'var(--text-primary)' }}>
                          {s.percentage}%
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          ({s.absentSessions} absent)
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>



        {/* Quick Actions */}
        <div className="portal-card">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
            Quick Actions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: 'group_add', label: 'Enroll New Walk-in', sub: 'Add a new student enquiry', to: '/admissions' },
              { icon: 'account_balance_wallet', label: 'Log Offline Payment', sub: 'Receive cash or check', to: '/fees' },
              { icon: 'event_available', label: 'Mark Attendance', sub: 'Update absentee list', to: '/attendance' },
              { icon: 'inventory_2', label: 'Check Stock', sub: 'View inventory ledger', to: '/inventory' },
            ].map(({ icon, label, sub, to }) => (
              <a
                key={to}
                href={to}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 12,
                  background: 'var(--surface-base)',
                  border: '1px solid var(--surface-border)',
                  transition: 'all 0.2s ease',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(253,180,42,0.3)';
                  e.currentTarget.style.background = 'var(--surface-elevated)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--surface-border)';
                  e.currentTarget.style.background = 'var(--surface-base)';
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'rgba(253,180,42,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)', fontSize: 20 }}>
                    {icon}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>
                </div>
                <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: 18, marginLeft: 'auto' }}>
                  chevron_right
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
