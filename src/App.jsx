import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AdminClaims from './pages/AdminClaims';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import ReportLost from './pages/ReportLost';
import ReportFound from './pages/ReportFound';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import AdminImportStudents from './pages/AdminImportStudents';
import AdminStudentManagement from './pages/AdminStudentManagement';
import AdminIncidents from './pages/AdminIncidents';
import AdminReports from './pages/AdminReports';
import AdminHandovers from './pages/AdminHandovers';
import AdminUserManagement from './pages/AdminUserManagement';
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
    <AuthProvider>
      <Router>
        <div className="app-wrapper">
          <Navbar />
          <div className="main-content">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/report-lost" element={<ReportLost />} />
              <Route path="/report-found" element={<ReportFound />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/change-password"
                element={
                  <ProtectedRoute>
                    <ChangePassword />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/dashboard"
                element={
                  <AdminRoute>
                    <Dashboard />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/management"
                element={
                  <AdminRoute requireAdminRole={true}>
                    <AdminUserManagement />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <AdminRoute requireAdminRole={true}>
                    <AdminUserManagement />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/import-students"
                element={
                  <AdminRoute requireAdminRole={true}>
                    <AdminImportStudents />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/incidents"
                element={
                  <AdminRoute>
                    <AdminIncidents />
                  </AdminRoute>
                }
              />
                <Route
                  path="/admin/reports"
                  element={
                    <AdminRoute>
                      <AdminReports />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/handovers"
                  element={
                    <AdminRoute>
                      <AdminHandovers />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/claims"
                  element={
                    <AdminRoute>
                      <AdminClaims />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/students"
                  element={
                    <AdminRoute requireAdminRole={true}>
                      <AdminStudentManagement />
                    </AdminRoute>
                  }
                />

              {/* 404 Catch-All */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}
