import { Routes, Route, Navigate } from 'react-router-dom';
import { HRRoute, EmployeeRoute, PublicRoute } from './components/common/ProtectedRoute';

// Auth
import Login from './pages/auth/Login';
import Unauthorized from './pages/auth/Unauthorized';

// HR Pages
import HRDashboard from './pages/hr/HRDashboard';

// Employee Pages
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import WorkLog from './pages/employee/WorkLog';

// Placeholder for Phase 2 pages
const Placeholder = ({ title }) => (
  <div className="flex items-center justify-center min-h-screen bg-cream">
    <div className="text-center">
      <div className="w-16 h-16 bg-gold-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
        <span className="text-gold text-2xl">🚧</span>
      </div>
      <h2 className="font-heading text-navy text-2xl font-bold">{title}</h2>
      <p className="text-navy text-opacity-50 mt-2">Coming in Phase 2</p>
    </div>
  </div>
);

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      {/* HR Routes */}
      <Route path="/hr/dashboard"     element={<HRRoute><HRDashboard /></HRRoute>} />
      <Route path="/hr/employees"     element={<HRRoute><Placeholder title="All Employees" /></HRRoute>} />
      <Route path="/hr/tasks"         element={<HRRoute><Placeholder title="Task Assignment" /></HRRoute>} />
      <Route path="/hr/work-logs"     element={<HRRoute><Placeholder title="Work Logs" /></HRRoute>} />
      <Route path="/hr/attendance"    element={<HRRoute><Placeholder title="Attendance" /></HRRoute>} />
      <Route path="/hr/leaves"        element={<HRRoute><Placeholder title="Leave Management" /></HRRoute>} />
      <Route path="/hr/announcements" element={<HRRoute><Placeholder title="Announcements" /></HRRoute>} />
      <Route path="/hr/reports"       element={<HRRoute><Placeholder title="Reports" /></HRRoute>} />
      <Route path="/hr/messages"      element={<HRRoute><Placeholder title="Messages" /></HRRoute>} />

      {/* Employee Routes */}
      <Route path="/employee/dashboard" element={<EmployeeRoute><EmployeeDashboard /></EmployeeRoute>} />
      <Route path="/employee/work-log"  element={<EmployeeRoute><WorkLog /></EmployeeRoute>} />
      <Route path="/employee/tasks"     element={<EmployeeRoute><Placeholder title="My Tasks" /></EmployeeRoute>} />
      <Route path="/employee/reports"   element={<EmployeeRoute><Placeholder title="My Reports" /></EmployeeRoute>} />
      <Route path="/employee/leave"     element={<EmployeeRoute><Placeholder title="Leave Requests" /></EmployeeRoute>} />
      <Route path="/employee/messages"  element={<EmployeeRoute><Placeholder title="Messages" /></EmployeeRoute>} />
      <Route path="/employee/profile"   element={<EmployeeRoute><Placeholder title="My Profile" /></EmployeeRoute>} />

      {/* Default */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
