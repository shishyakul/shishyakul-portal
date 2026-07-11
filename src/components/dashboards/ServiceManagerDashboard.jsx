import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../NotificationBell';

export default function ServiceManagerDashboard() {
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({ pendingGrievances: 0, pendingDemos: 0, unassignedStudents: 0 });
  const [timetable, setTimetable] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [syllabusProgress, setSyllabusProgress] = useState([]);
  const [testWorkflows, setTestWorkflows] = useState([]);
  const [lectureReports, setLectureReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const getTodayDateStr = () => {
    const today = new Date();
    // Offset for local timezone issues, better to just use local YYYY-MM-DD
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

    const unsubGrievances = onSnapshot(collection(db, 'grievances'), (snap) => {
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

  // Today's Live Feed
  const todayDate = new Date();
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const currentDay = days[todayDate.getDay()];
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
    // Format for display as MM-DD
    return { date: dateStr.substring(5), rate };
  });

  // Workflows
  const drafted = testWorkflows.filter(t => t.status === 'draft_submitted');
  const published = testWorkflows.filter(t => t.status === 'final_published');
  const graded = testWorkflows.filter(t => t.status === 'graded');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Service Analytics Hub</h1>
          <p className="page-subtitle">Deep dive into operational, academic, and administrative metrics.</p>
        </div>
      </div>

      {/* ZONE 1: Global KPIs */}
      <div className="grid-auto-250" style={{ gap: '16px' }}>
        <div className="portal-card" style={{ borderLeft: '4px solid #10b981', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ background: '#d1fae5', padding: '12px', borderRadius: '12px', display: 'flex' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#10b981' }}>diversity_3</span>
          </div>
          <div>
            <h3 style={{ fontSize: 24, margin: 0, fontWeight: 700 }}>{activeStudentsCount}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Active Admitted Students</p>
          </div>
        </div>
        
        <div className="portal-card" style={{ borderLeft: `4px solid ${attendanceRate < 85 ? '#ef4444' : 'var(--brand-primary)'}`, display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ background: attendanceRate < 85 ? '#fee2e2' : 'rgba(253,180,42,0.15)', padding: '12px', borderRadius: '12px', display: 'flex' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: attendanceRate < 85 ? '#ef4444' : 'var(--brand-primary)' }}>how_to_reg</span>
          </div>
          <div>
            <h3 style={{ fontSize: 24, margin: 0, fontWeight: 700 }}>{attendanceRate}%</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Today's Attendance</p>
          </div>
        </div>

        <div className="portal-card" style={{ borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', cursor: 'pointer' }} onClick={() => navigate('/faculty')}>
          <div style={{ background: '#fee2e2', padding: '12px', borderRadius: '12px', display: 'flex' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#ef4444' }}>warning</span>
          </div>
          <div>
            <h3 style={{ fontSize: 24, margin: 0, fontWeight: 700 }}>{stats.pendingGrievances}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Unresolved Grievances</p>
          </div>
        </div>

        <div className="portal-card" style={{ borderLeft: '4px solid #3b82f6', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ background: '#dbeafe', padding: '12px', borderRadius: '12px', display: 'flex' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#3b82f6' }}>quiz</span>
          </div>
          <div>
            <h3 style={{ fontSize: 24, margin: 0, fontWeight: 700 }}>{published.length}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Active Published Tests</p>
          </div>
        </div>
      </div>

      {/* ZONE 2: Analytics Charts */}
      <div className="grid-2" style={{ gap: '24px' }}>
        <div className="portal-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: 18, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--brand-primary)' }}>ssid_chart</span>
            7-Day Attendance Trend
          </h2>
          <div style={{ height: 250, width: '100%' }}>
            <ResponsiveContainer>
              <LineChart data={attendanceTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#888' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Line type="monotone" dataKey="rate" name="Attendance %" stroke="var(--brand-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--brand-primary)', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="portal-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: 18, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: '#10b981' }}>menu_book</span>
            Top 10 Batch Syllabus Completion
          </h2>
          <div style={{ height: 250, width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={syllabusData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#888' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f5f5f5' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="avgProgress" name="Avg Completion %" radius={[4, 4, 0, 0]}>
                  {syllabusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.avgProgress < 40 ? '#ef4444' : entry.avgProgress > 80 ? '#10b981' : 'var(--brand-primary)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ZONE 3: Operations & Test Workflows */}
      <div className="grid-1-2" style={{ gap: '24px' }}>
        
        {/* Workload */}
        <div className="portal-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: 18, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: '#6366f1' }}>groups</span>
            Faculty Workload (Lectures)
          </h2>
          <div style={{ height: 320, width: '100%' }}>
            <ResponsiveContainer>
              <BarChart data={workloadData} layout="vertical" margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12, fill: '#555' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" name="Weekly Lectures" radius={[0, 4, 4, 0]} barSize={20}>
                  {workloadData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#6366f1' : '#a5b4fc'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Classes & Tests */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Test Workflows Pipeline */}
          <div className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: 'var(--surface-bg)', borderBottom: '1px solid var(--surface-border)' }}>
              <h2 style={{ margin: 0, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>account_tree</span>
                Test Duty Pipeline
              </h2>
            </div>
            <div className="grid-3" style={{ padding: '20px', gap: 16 }}>
              <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <h4 style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px 0', textTransform: 'uppercase' }}>Drafted ({drafted.length})</h4>
                {drafted.slice(0,3).map(t => (
                  <div key={t.id} style={{ background: '#fff', padding: 8, borderRadius: 6, fontSize: 12, border: '1px solid #d1d5db', marginBottom: 8 }}>
                    <strong>{t.batch}</strong>
                    <div style={{ color: '#6b7280', marginTop: 4 }}>{t.subject}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                <h4 style={{ fontSize: 13, color: '#166534', margin: '0 0 12px 0', textTransform: 'uppercase' }}>Published ({published.length})</h4>
                {published.slice(0,3).map(t => (
                  <div key={t.id} style={{ background: '#fff', padding: 8, borderRadius: 6, fontSize: 12, border: '1px solid #86efac', marginBottom: 8 }}>
                    <strong>{t.batch}</strong>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <a href={t.finalLink} target="_blank" rel="noreferrer" style={{ fontSize: 10, background: '#dcfce7', padding: '2px 6px', borderRadius: 4, textDecoration: 'none', color: '#166534' }}>Paper</a>
                      <a href={t.solutionsLink} target="_blank" rel="noreferrer" style={{ fontSize: 10, background: '#dbeafe', padding: '2px 6px', borderRadius: 4, textDecoration: 'none', color: '#1e40af' }}>Sol</a>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fef3c7', padding: 12, borderRadius: 8, border: '1px solid #fde68a' }}>
                <h4 style={{ fontSize: 13, color: '#92400e', margin: '0 0 12px 0', textTransform: 'uppercase' }}>Graded ({graded.length})</h4>
                {graded.slice(0,3).map(t => (
                  <div key={t.id} style={{ background: '#fff', padding: 8, borderRadius: 6, fontSize: 12, border: '1px solid #fcd34d', marginBottom: 8 }}>
                    <strong>{t.batch}</strong>
                    <div style={{ color: '#92400e', marginTop: 4, fontSize: 10 }}>Marks Uploaded</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Today's Live Feed */}
          <div className="portal-card" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', background: 'var(--surface-bg)', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>📅 Today's Live Classes ({currentDay})</h2>
              <span className="badge badge-branch-manager">{todaysClasses.length} Classes</span>
            </div>
            <div style={{ padding: 20, flex: 1, overflowY: 'auto', maxHeight: '250px' }}>
              {todaysClasses.length === 0 ? (
                <div className="empty-state">No classes scheduled for today.</div>
              ) : (
                <div className="grid-auto-250" style={{ gap: '12px' }}>
                  {todaysClasses.map((cls, idx) => (
                    <div key={idx} style={{ display: 'flex', background: 'var(--bg-main)', padding: '12px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                      <div style={{ width: '90px', borderRight: '1px solid var(--surface-border)', paddingRight: '12px', marginRight: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--brand-primary)', fontSize: 13 }}>{cls.slot}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Kaksh: {cls.room}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{cls.batch}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span>{cls.subject || 'N/A'}</span>
                          <span style={{ color: 'var(--text-primary)' }}>👨‍🏫 {cls.teacher}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* Post-Lecture Reports Feed */}
          <div className="portal-card" style={{ padding: 0, overflow: 'hidden' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {lectureReports.slice(0, 10).map((rep) => (
                    <div key={rep.id} style={{ background: 'var(--surface-bg)', padding: 16, borderRadius: 8, borderLeft: '4px solid #10b981', borderTop: '1px solid var(--surface-border)', borderRight: '1px solid var(--surface-border)', borderBottom: '1px solid var(--surface-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{rep.batch} <span style={{ color: 'var(--text-secondary)', fontWeight: 'normal' }}>| {rep.subject}</span></div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rep.date} • {rep.teacherName}</div>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>
                        <strong>Topic:</strong> {rep.topicTaught} <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>({rep.amountTaught})</span>
                      </div>
                      <div style={{ fontSize: 13, background: '#f9fafb', padding: 8, borderRadius: 4, marginBottom: 8 }}>
                        <strong>Homework:</strong> {rep.homework}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                        <span><strong>Next:</strong> {rep.nextTarget}</span>
                        {rep.remarks && <span style={{ fontStyle: 'italic' }}>Note: {rep.remarks}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
