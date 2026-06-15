// Admin Dashboard — overview with stats, recent users, quick actions
import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const ROLE_COLORS = {
  admin: 'badge-admin',
  teacher: 'badge-teacher',
  student: 'badge-student',
};

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ admins: 0, teachers: 0, students: 0, total: 0 });
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const counts = users.reduce(
          (acc, u) => {
            acc.total++;
            if (u.role === 'admin')   acc.admins++;
            if (u.role === 'teacher') acc.teachers++;
            if (u.role === 'student') acc.students++;
            return acc;
          },
          { admins: 0, teachers: 0, students: 0, total: 0 }
        );

        setStats(counts);
        setRecentUsers(users.slice(0, 5));
      } catch (e) {
        console.error('Dashboard fetch error:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const statCards = [
    {
      label: 'Total Users',
      value: stats.total,
      icon: 'group',
      color: 'rgba(253,180,42,0.15)',
      iconColor: '#fdb42a',
    },
    {
      label: 'Admins',
      value: stats.admins,
      icon: 'shield',
      color: 'rgba(253,180,42,0.1)',
      iconColor: '#fdb42a',
    },
    {
      label: 'Teachers',
      value: stats.teachers,
      icon: 'school',
      color: 'rgba(59,130,246,0.12)',
      iconColor: '#60a5fa',
    },
    {
      label: 'Students',
      value: stats.students,
      icon: 'person',
      color: 'rgba(34,197,94,0.12)',
      iconColor: '#4ade80',
    },
  ];

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
            Here's what's happening at Shishyakul today.
          </p>
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="stat-card"
              style={{
                flex: 1,
                background: 'var(--surface-card)',
                animation: 'pulse 1.5s ease-in-out infinite',
                minHeight: 100,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="grid-4" style={{ marginBottom: 28 }}>
          {statCards.map(({ label, value, icon, color, iconColor }) => (
            <div className="stat-card" key={label}>
              <div className="stat-icon" style={{ background: color }}>
                <span
                  className="material-symbols-outlined filled"
                  style={{ color: iconColor, fontSize: 22 }}
                >
                  {icon}
                </span>
              </div>
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid-2" style={{ alignItems: 'start' }}>

        {/* Recent Users */}
        <div className="portal-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
              Recent Users
            </h2>
            <a
              href="/users"
              style={{ fontSize: 13, color: 'var(--brand-primary)', fontWeight: 600 }}
            >
              View all →
            </a>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="spinner" />
            </div>
          ) : recentUsers.length === 0 ? (
            <div className="empty-state">
              <span className="material-symbols-outlined">group_off</span>
              <p>No users yet. Add users from the Users section.</p>
            </div>
          ) : (
            <table className="portal-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                        {u.fullName || 'Unknown'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {u.email}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${ROLE_COLORS[u.role] ?? 'badge-student'}`}>
                        {u.role}
                      </span>
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
              { icon: 'person_add', label: 'Add New User',        sub: 'Create admin, teacher, or student', to: '/users' },
              { icon: 'campaign',   label: 'New Announcement',    sub: 'Post a notice to all users',        to: '/announcements' },
              { icon: 'event_available', label: 'Record Attendance', sub: 'Mark attendance for today',     to: '/attendance' },
              { icon: 'assignment', label: 'Create Assignment',   sub: 'Distribute homework to students',   to: '/assignments' },
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
