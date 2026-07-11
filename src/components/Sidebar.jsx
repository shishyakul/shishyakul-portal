import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const ROLE_BADGE = { 
  admin: 'badge-admin', 
  branch_manager: 'badge-branch-manager', 
  service_manager: 'badge-service-manager', 
  front_desk_manager: 'badge-front-desk',
  inventory_manager: 'badge-inventory-manager',
  teacher: 'badge-teacher',
  student: 'badge-student'
};

const formatRole = (role) => {
  if (!role) return 'Unknown';
  return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const NAV_CONFIG = {
  admin: [
    { to: '/dashboard',   icon: 'dashboard',       label: 'Dashboard' },
    { to: '/enquiries',   icon: 'person_add',      label: 'Enquiries' },
    { to: '/pending-admissions', icon: 'assignment_ind', label: 'Pending Admissions' },
    { to: '/admissions',  icon: 'how_to_reg',      label: 'Admissions' },
    { to: '/demo-dashboard', icon: 'table_chart',  label: 'Demo Dashboard' },
    { to: '/batches',     icon: 'view_kanban',     label: 'Batch Allocation' },
    { to: '/fees',        icon: 'payments',        label: 'Fees Ledger' },
    { to: '/attendance',  icon: 'event_available', label: 'Attendance' },
    { to: '/students',    icon: 'school',          label: 'Students' },
  ],
  branch_manager: [
    { to: '/dashboard',   icon: 'dashboard',       label: 'Dashboard' },
    { to: '/enquiries',   icon: 'person_add',      label: 'Enquiries' },
    { to: '/admissions',  icon: 'how_to_reg',      label: 'Admissions' },
    { to: '/demo-dashboard', icon: 'table_chart',  label: 'Demo Dashboard' },
    { to: '/batches',     icon: 'view_kanban',     label: 'Batch Allocation' },
    { to: '/students',    icon: 'school',          label: 'Students' },
    { to: '/attendance',  icon: 'event_available', label: 'Attendance' },
    { to: '/users',       icon: 'group',           label: 'Manage Teachers' },
  ],
  service_manager: [
    { to: '/dashboard',   icon: 'dashboard',       label: 'Dashboard' },
    { to: '/faculty',     icon: 'school',          label: 'Faculty Hub' },
    { to: '/students',    icon: 'school',          label: 'Students' },
    { to: '/attendance',  icon: 'event_available', label: 'Attendance' },
    { to: '/users',       icon: 'group',           label: 'Manage Teachers' },
  ],
  front_desk_manager: [
    { to: '/dashboard',   icon: 'dashboard',       label: 'Dashboard' },
    { to: '/enquiries',   icon: 'person_add',      label: 'Walk-in Enquiries' },
    { to: '/pending-admissions', icon: 'assignment_ind', label: 'Pending Admissions' },
    { to: '/students',    icon: 'school',          label: 'Students' },
    { to: '/attendance',  icon: 'event_available', label: 'Daily Attendance' },
    { to: '/inventory',   icon: 'inventory_2',     label: 'Asset Ledger' },
  ],
  inventory_manager: [
    { to: '/dashboard',   icon: 'dashboard',       label: 'Dashboard' },
    { to: '/inventory',   icon: 'inventory_2',     label: 'Asset Ledger' },
  ],
  teacher: [
    { to: '/dashboard#home',      icon: 'dashboard',            label: 'Dashboard' },
    { to: '/dashboard#dashboard_hub', icon: 'home',     label: 'Home' },
    { to: '/dashboard#batches',   icon: 'groups',          label: 'My Batches' },
    { to: '/dashboard#timetable', icon: 'dashboard',       label: 'My Timetable' },
    { to: '/dashboard#materials', icon: 'auto_stories',    label: 'Course Materials' },
    { to: '/dashboard#grading',   icon: 'grading',         label: 'Grading & Submissions' },
    { to: '/dashboard#attendance', icon: 'event_available', label: 'Attendance' },
    { to: '/dashboard#performance', icon: 'military_tech', label: 'Performance' },
    { to: '/dashboard#feedbacks',  icon: 'reviews',        label: 'Manager Feedback' },
  ],
  student: [
    { to: '/dashboard#feed',      icon: 'dashboard',       label: 'My Feed' },
    { to: '/dashboard#submit',    icon: 'assignment',      label: 'Submit Work' },
    { to: '/dashboard#timetable', icon: 'calendar_month',  label: 'Timetable' },
    { to: '/dashboard#attendance',icon: 'event_available', label: 'Attendance' },
    { to: '/dashboard#performance',icon: 'military_tech',  label: 'Performance' },
    { to: '/dashboard#feedback_ptm', icon: 'rate_review', label: 'Teacher Feeds & Notices' },
    { to: '/dashboard#finances',  icon: 'payments',        label: 'Finances' },
    { to: '/dashboard#support',   icon: 'support_agent',   label: 'Support' }
  ]
};

export default function Sidebar({ isOpen, onClose }) {
  const { profile, logout, switchTestUser } = useAuth();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
  }, [isCollapsed]);

  const handleTestRoleChange = (e) => {
    const roles = {
      admin: { role: 'admin', email: 'coreadmin@shishyakul.in', name: 'Vaishali Mam' },
      branch_manager: { role: 'branch_manager', email: 'branch@shishyakul.in', name: 'Sumit Sir' },
      service_manager: { role: 'service_manager', email: 'service@shishyakul.in', name: 'Rohan Sir' },
      front_desk_manager: { role: 'front_desk_manager', email: 'frontdesk@shishyakul.in', name: 'Shruti Kamble' },
      inventory_manager: { role: 'inventory_manager', email: 'inventory@shishyakul.in', name: 'Rupali More' },
      teacher: { role: 'teacher', email: 'teacher@shishyakul.in', name: 'Test Faculty' },
      student: { role: 'student', email: 'student@shishyakul.in', name: 'Test Student' }
    };
    if (roles[e.target.value] && switchTestUser) {
      switchTestUser(roles[e.target.value]);
    }
  };

  const [badges, setBadges] = useState({});
  const [clearedBadges, setClearedBadges] = useState({});

  useEffect(() => {
    if (profile?.email) {
      try {
        const saved = localStorage.getItem(`shishyakul_cleared_badges_${profile.email}`);
        if (saved) {
          setClearedBadges(JSON.parse(saved));
        }
      } catch (err) {
        console.error(err);
      }
    }
  }, [profile?.email]);

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail) {
        // e.detail should be like { tabLabel: { count: 2, id: 'timestamp_or_hash' } }
        setBadges(prev => ({ ...prev, ...e.detail }));
      }
    };
    window.addEventListener('updateSidebarBadges', handleUpdate);
    return () => window.removeEventListener('updateSidebarBadges', handleUpdate);
  }, []);

  const handleTabClick = (label) => {
    if (badges[label]) {
      setClearedBadges(prev => {
        const next = { ...prev, [label]: badges[label].id || badges[label].count };
        localStorage.setItem(`shishyakul_cleared_badges_${profile?.email}`, JSON.stringify(next));
        return next;
      });
    }
  };

  const baseNavItems = NAV_CONFIG[profile?.role] || NAV_CONFIG.front_desk_manager;
  let navItems = [...baseNavItems];
  if (profile?.role === 'student' && profile?.battalionEnrolled) {
    navItems.push({ to: '/dashboard#battalion', icon: 'hub', label: 'Battalion Network' });
  }

  return (
    <>
      {/* Mobile Top Header (Visible only on phones) */}
      <div className="mobile-top-header">
        <div className="mobile-header-brand">
          <img src="/favicon.png" alt="Shishyakul" className="mobile-header-logo" />
          <span className="mobile-header-text">Shishyakul</span>
        </div>
        <button className="sidebar-logout-btn" onClick={logout} title="Logout">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>

      <div 
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`} 
        onClick={onClose}
      />
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand">
        {profile?.role === 'teacher' ? (
          <>
            <div className="sidebar-avatar" style={{ width: 40, height: 40, fontSize: 16, marginRight: 12 }}>
              {(profile?.fullName ?? 'T')[0].toUpperCase()}
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">{profile?.fullName ?? 'Teacher'}</span>
              <span className="sidebar-brand-sub" style={{ color: 'var(--brand-primary)' }}>Empower Shishya</span>
            </div>
          </>
        ) : (
          <>
            <img
              src="/favicon.png"
              alt="Shishyakul"
              className="sidebar-logo"
            />
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">Shishyakul</span>
              <span className="sidebar-brand-sub">{profile?.role === 'student' ? 'Student Portal' : 'Admin Portal'}</span>
            </div>
          </>
        )}
        <button className="sidebar-collapse-btn" onClick={() => setIsCollapsed(!isCollapsed)}>
          <span className="material-symbols-outlined">
            {isCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>

      {/* Role badge */}
      <div className="sidebar-role-wrap">
        <span className={`badge ${ROLE_BADGE[profile?.role] ?? 'badge-service-manager'}`}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            {profile?.role === 'admin' || profile?.role === 'branch_manager' ? 'shield' : profile?.role === 'service_manager' ? 'support_agent' : profile?.role === 'inventory_manager' ? 'inventory_2' : 'storefront'}
          </span>
          {formatRole(profile?.role ?? 'admin')}
        </span>
      </div>

      {/* Nav links */}
      <nav className="sidebar-nav">
        {navItems.map(({ to, icon, label }) => {
          const isHashLink = to.includes('#');
          let isActive = false;
          
          if (isHashLink && location.pathname === '/dashboard') {
             const targetHash = to.split('#')[1];
             const currentHash = location.hash.replace('#', '');
             
             if (currentHash === targetHash) {
               isActive = true;
             } else if (!currentHash && (targetHash === 'batches' || targetHash === 'feed')) {
               isActive = true;
             }
          } else {
             isActive = location.pathname.startsWith(to);
          }

          return (
            <NavLink
              key={to}
              to={to}
              className={`sidebar-link ${isActive ? 'sidebar-link--active' : ''}`}
              onClick={() => handleTabClick(label)}
            >
              <span className="material-symbols-outlined sidebar-link-icon">{icon}</span>
              <span className="sidebar-link-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                {label}
                {badges[label] && badges[label].count > 0 && clearedBadges[label] !== (badges[label].id || badges[label].count) && (
                  <span className="badge" style={{ marginLeft: 6, background: '#e65100', color: 'white', padding: '2px 6px', fontSize: 10 }}>
                    {badges[label].count}
                  </span>
                )}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      {profile?.role !== 'teacher' ? (
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
      ) : (
        <div style={{ padding: '16px', marginTop: 'auto' }}>
          <button 
            className="btn btn-outline" 
            onClick={logout}
            style={{ 
              width: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              color: '#ef4444', 
              borderColor: '#ef4444',
              borderRadius: '8px',
              padding: '10px 0',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
            Logout
          </button>
        </div>
      )}

      {/* DEV ONLY ROLE SWITCHER */}
      {window.location.hostname === 'localhost' && (
        <div className="sidebar-test-switcher" style={{ padding: '12px', borderTop: '1px solid var(--surface-border)' }}>
          <p className="sidebar-test-switcher-label" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Local Test Switcher:</p>
          <select 
            value={profile?.role || 'front_desk_manager'} 
            onChange={handleTestRoleChange}
            style={{ width: '100%', padding: '6px', borderRadius: '6px', fontSize: '12px', background: 'var(--surface-bg)', color: 'var(--text-primary)', border: '1px solid var(--brand-primary)' }}
          >
            <option value="front_desk_manager">Front Desk (Shruti)</option>
            <option value="admin">System Admin (Vaishali)</option>
            <option value="branch_manager">Branch Manager (Sumit)</option>
            <option value="service_manager">Service Manager (Rohan)</option>
            <option value="inventory_manager">Inventory (Rupali)</option>
            <option value="teacher">Teacher (Test)</option>
            <option value="student">Student (Test)</option>
          </select>
        </div>
      )}
    </aside>
    </>
  );
}
