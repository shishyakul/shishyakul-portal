import { useAuth } from '../contexts/AuthContext';
import AdminDashboard from '../components/dashboards/AdminDashboard';
import ServiceManagerDashboard from '../components/dashboards/ServiceManagerDashboard';
import FrontendDeskDashboard from '../components/dashboards/FrontendDeskDashboard';
import InventoryDashboard from '../components/dashboards/InventoryDashboard';
import TeacherDashboard from '../components/dashboards/TeacherDashboard';
import StudentDashboard from '../components/dashboards/StudentDashboard';

export default function Dashboard() {
  const { profile, loading } = useAuth();

  if (loading || !profile) {
    return (
      <div className="empty-state" style={{ minHeight: '80vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  switch (profile.role) {
    case 'admin':
    case 'branch_manager':
      return <AdminDashboard profile={profile} />;
    case 'service_manager':
      return <ServiceManagerDashboard profile={profile} />;
    case 'inventory_manager':
      return <InventoryDashboard profile={profile} />;
    case 'teacher':
      return <TeacherDashboard profile={profile} />;
    case 'student':
      return <StudentDashboard profile={profile} />;
    case 'front_desk_manager':
    default:
      return <FrontendDeskDashboard profile={profile} />;
  }
}
