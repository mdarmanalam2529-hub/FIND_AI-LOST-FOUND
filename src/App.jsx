import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import PublicLayout from './layouts/PublicLayout';
import StudentLayout from './layouts/StudentLayout';
import AdminLayout from './layouts/AdminLayout';
import Home from './pages/Home';
import ReportLost from './pages/ReportLost';
import ReportFound from './pages/ReportFound';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Community from './pages/Community';
import AdminDashboard from './pages/AdminDashboard';
import AdminReports from './pages/AdminReports';
import AdminClaims from './pages/AdminClaims';
import AdminHandovers from './pages/AdminHandovers';
import AdminIncidents from './pages/AdminIncidents';
import AdminStudentManagement from './pages/AdminStudentManagement';
import AdminUserManagement from './pages/AdminUserManagement';
import AdminImportStudents from './pages/AdminImportStudents';
import './App.css';

// 404 Fallback View
function NotFound() {
  return (
    <div className="container not-found-wrapper">
      <div className="not-found-code gradient-text">404</div>
      <h2 style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>Page Not Found</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '400px' }}>
        The link you followed may be broken or the page may have been moved.
      </p>
      <Link to="/" className="btn btn-primary">
        Return to Home
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Layout Hierarchy */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/report-lost" element={<ReportLost />} />
              <Route path="/report-found" element={<ReportFound />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/register" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/change-password"
                element={
                  <ProtectedRoute>
                    <ChangePassword />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Route>

            {/* Student Workspace Layout Hierarchy */}
            <Route element={<ProtectedRoute />}>
              <Route element={<StudentLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/student" element={<Dashboard />} />
                <Route path="/student/dashboard" element={<Dashboard />} />
                <Route path="/community" element={<Community />} />
                <Route path="/student/community" element={<Community />} />
              </Route>
            </Route>

            {/* Admin Workspace Layout Hierarchy */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="claims" element={<AdminClaims />} />
                <Route path="handovers" element={<AdminHandovers />} />
                <Route
                  path="incidents"
                  element={
                    <AdminRoute>
                      <AdminIncidents />
                    </AdminRoute>
                  }
                />
                <Route
                  path="students"
                  element={
                    <AdminRoute requireAdminRole={true}>
                      <AdminStudentManagement />
                    </AdminRoute>
                  }
                />
                <Route
                  path="management"
                  element={
                    <AdminRoute requireAdminRole={true}>
                      <AdminUserManagement />
                    </AdminRoute>
                  }
                />
                <Route
                  path="users"
                  element={
                    <AdminRoute requireAdminRole={true}>
                      <AdminUserManagement />
                    </AdminRoute>
                  }
                />
                <Route
                  path="import-students"
                  element={
                    <AdminRoute requireAdminRole={true}>
                      <AdminImportStudents />
                    </AdminRoute>
                  }
                />
              </Route>
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
