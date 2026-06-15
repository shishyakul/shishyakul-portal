// Placeholder pages for sections not yet built
// These keep routing working while we build them one by one

export function Announcements() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="page-subtitle">Post notices and updates for all users</p>
        </div>
      </div>
      <div className="portal-card empty-state" style={{ minHeight: 280 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--brand-primary)', opacity: 0.5 }}>campaign</span>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Coming Soon</p>
        <p>Announcements feature is being built. Check back soon!</p>
      </div>
    </div>
  );
}

export function Attendance() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">Track and manage student attendance</p>
        </div>
      </div>
      <div className="portal-card empty-state" style={{ minHeight: 280 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--brand-primary)', opacity: 0.5 }}>event_available</span>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Coming Soon</p>
        <p>Attendance tracking is being built. Check back soon!</p>
      </div>
    </div>
  );
}

export function Assignments() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Assignments</h1>
          <p className="page-subtitle">Create and manage homework assignments</p>
        </div>
      </div>
      <div className="portal-card empty-state" style={{ minHeight: 280 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--brand-primary)', opacity: 0.5 }}>assignment</span>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Coming Soon</p>
        <p>Assignments management is being built. Check back soon!</p>
      </div>
    </div>
  );
}

export function Fees() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fees</h1>
          <p className="page-subtitle">Manage student fee records</p>
        </div>
      </div>
      <div className="portal-card empty-state" style={{ minHeight: 280 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--brand-primary)', opacity: 0.5 }}>payments</span>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Coming Soon</p>
        <p>Fee management is being built. Check back soon!</p>
      </div>
    </div>
  );
}
