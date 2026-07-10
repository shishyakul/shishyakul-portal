import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import AuthHandler from './pages/AuthHandler';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';

import Inventory from './pages/Inventory';
import Faculty from './pages/Faculty';
import EnquiryKiosk from './pages/EnquiryKiosk';
import AttendanceGrid from './pages/AttendanceGrid';
import Admissions from './pages/Admissions';
import PendingAdmissions from './pages/PendingAdmissions';
import Batches from './pages/Batches';
import FeesLedger from './pages/FeesLedger';
import DemoDashboard from './pages/DemoDashboard';
import StudentsDirectory from './pages/StudentsDirectory';
import './index.css';

import TopActions from './components/TopActions';

/* ── Layout wrapper for authenticated pages ── */
function PortalLayout({ children }) {
  return (
    <div className="portal-shell">
      <TopActions />
      <Sidebar />
      <main className="portal-main">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public: receives token from shishyakul.in/login */}
            <Route path="/auth" element={<AuthHandler />} />

            {/* Protected: admin dashboard routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <PortalLayout>
                  <Dashboard />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['admin', 'branch_manager', 'service_manager']}>
                <PortalLayout>
                  <Users />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/enquiries" element={
              <ProtectedRoute>
                <PortalLayout>
                  <EnquiryKiosk />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/admissions" element={
              <ProtectedRoute>
                <PortalLayout>
                  <Admissions />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/pending-admissions" element={
              <ProtectedRoute>
                <PortalLayout>
                  <PendingAdmissions />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/demo-dashboard" element={
              <ProtectedRoute>
                <PortalLayout>
                  <DemoDashboard />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/attendance" element={
              <ProtectedRoute>
                <PortalLayout>
                  <AttendanceGrid />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/fees" element={
              <ProtectedRoute>
                <PortalLayout>
                  <FeesLedger />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/inventory" element={
              <ProtectedRoute>
                <PortalLayout>
                  <Inventory />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/faculty" element={
              <ProtectedRoute>
                <PortalLayout>
                  <Faculty />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/analytics" element={
              <ProtectedRoute>
                <PortalLayout>
                  <Dashboard />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/batches" element={
              <ProtectedRoute>
                <PortalLayout>
                  <Batches />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/students" element={
              <ProtectedRoute>
                <PortalLayout>
                  <StudentsDirectory />
                </PortalLayout>
              </ProtectedRoute>
            } />

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </HelmetProvider>
  );
}
