// Portal Sidebar — navigation for admin dashboard
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const ROLE_BADGE = { 
  admin: 'badge-admin', 
  branch_manager: 'badge-branch-manager', 
  service_manager: 'badge-service-manager', 
  frontend_desk_manager: 'badge-frontend-desk',
  inventory_manager: 'badge-inventory-manager'
};

const formatRole = (role) => {
  if (!role) return 'Unknown';
  return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const adminNav = [
  { to: '/dashboard',        icon: 'dashboard',      label: 'Dashboard' },
  { to: '/users',            icon: 'group',          label: 'Users' },
  { to: '/announcements',    icon: 'campaign',       label: 'Announcements' },
  { to: '/attendance',       icon: 'event_available',label: 'Attendance' },
  { to: '/assignments',      icon: 'assignment',     label: 'Assignments' },
  { to: '/fees',             icon: 'payments',       label: 'Fees' },
];

export default function Sidebar() {
  const { profile, logout } = useAuth();
  const location = useLocation();

  const navItems = adminNav; // Will expand for teacher/student later

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <img
          src="/favicon.png"
          alt="Shishyakul"
          className="sidebar-logo"
        />
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">Shishyakul</span>
          <span className="sidebar-brand-sub">Admin Portal</span>
        </div>
      </div>

      {/* Role badge */}
      <div className="sidebar-role-wrap">
        <span className={`badge ${ROLE_BADGE[profile?.role] ?? 'badge-service-manager'}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
            {profile?.role === 'admin' || profile?.role === 'branch_manager' ? 'shield' : profile?.role === 'service_manager' ? 'support_agent' : profile?.role === 'inventory_manager' ? 'inventory_2' : 'front_desk'}
          </span>
          {formatRole(profile?.role ?? 'admin')}
        </span>
      </div>

      {/* Nav links */}
      <nav className="sidebar-nav">
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
            }
          >
            <span className="material-symbols-outlined sidebar-link-icon">{icon}</span>
            <span className="sidebar-link-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {(profile?.fullName ?? 'A')[0].toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{profile?.fullName ?? 'Admin'}</span>
            <span className="sidebar-user-email">{profile?.email ?? ''}</span>
          </div>
        </div>
        <button className="sidebar-logout-btn" onClick={logout} title="Logout">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </aside>
  );
}
