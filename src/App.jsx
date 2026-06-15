import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import AuthHandler from './pages/AuthHandler';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import { Announcements, Attendance, Assignments, Fees } from './pages/Placeholders';
import './index.css';

/* ── Layout wrapper for authenticated pages ── */
function PortalLayout({ children }) {
  return (
    <div className="portal-shell">
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
              <ProtectedRoute adminOnly>
                <PortalLayout>
                  <Users />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/announcements" element={
              <ProtectedRoute>
                <PortalLayout>
                  <Announcements />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/attendance" element={
              <ProtectedRoute>
                <PortalLayout>
                  <Attendance />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/assignments" element={
              <ProtectedRoute>
                <PortalLayout>
                  <Assignments />
                </PortalLayout>
              </ProtectedRoute>
            } />

            <Route path="/fees" element={
              <ProtectedRoute adminOnly>
                <PortalLayout>
                  <Fees />
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
