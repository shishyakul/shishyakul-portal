export default function InventoryDashboard({ profile }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome, {profile?.fullName?.split(' ')[0] ?? 'Manager'} 👋</h1>
          <p className="page-subtitle">Inventory Manager Dashboard</p>
        </div>
      </div>
      <div className="portal-card">
        <p style={{ color: 'var(--text-secondary)' }}>
          Inventory operations and stock metrics will appear here.
        </p>
      </div>
    </div>
  );
}
