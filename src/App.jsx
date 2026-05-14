import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useEffect } from 'react';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import EventList from './pages/Events/EventList';
import EventDetail from './pages/Events/EventDetail';
import CreateEvent from './pages/Events/CreateEvent';
import AttendanceScanner from './pages/Attendance/AttendanceScanner';
import StudentCheckIn from './pages/Attendance/StudentCheckIn';
import CertificateManager from './pages/Certificates/CertificateManager';
import MyCertificates from './pages/Certificates/MyCertificates';
import AdminDashboard from './pages/Admin/AdminDashboard';
import ManageUsers from './pages/Admin/ManageUsers';
import Reports from './pages/Admin/Reports';
import Settings from './pages/Settings/Settings';
import Layout from './components/Layout';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

export default function App() {
  const { restoreToken } = useAuthStore();
  useEffect(() => { restoreToken(); }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="events" element={<EventList />} />
          <Route path="events/:id" element={<EventDetail />} />
          <Route path="events/create" element={<ProtectedRoute roles={['admin','organizer']}><CreateEvent /></ProtectedRoute>} />
          <Route path="attendance/:id" element={<ProtectedRoute roles={['admin','organizer']}><AttendanceScanner /></ProtectedRoute>} />
          <Route path="checkin" element={<ProtectedRoute roles={['student']}><StudentCheckIn /></ProtectedRoute>} />
          <Route path="certificates/:id" element={<ProtectedRoute roles={['admin','organizer']}><CertificateManager /></ProtectedRoute>} />
          <Route path="my-certificates" element={<ProtectedRoute roles={['student']}><MyCertificates /></ProtectedRoute>} />
          <Route path="admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="admin/users" element={<ProtectedRoute roles={['admin']}><ManageUsers /></ProtectedRoute>} />
          <Route path="admin/reports" element={<ProtectedRoute roles={['admin','organizer']}><Reports /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
