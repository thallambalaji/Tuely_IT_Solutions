import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const LoadingScreen = () => (
  <div className="min-h-screen bg-cream flex items-center justify-center">
    <div className="text-center">
      <div className="w-16 h-16 bg-navy rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
        <span className="text-gold font-heading text-3xl font-bold">T</span>
      </div>
      <p className="text-navy text-opacity-60 font-body text-sm animate-pulse">Loading Teuly Connect...</p>
    </div>
  </div>
);

/** Requires authenticated user with role === 'hr' */
export const HRRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== 'hr') return <Navigate to="/unauthorized" replace />;
  return children;
};

/** Requires authenticated user with role === 'employee' */
export const EmployeeRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== 'employee') return <Navigate to="/unauthorized" replace />;
  return children;
};

/** Redirect already-authenticated users away from login page */
export const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to={user.role === 'hr' ? '/hr/dashboard' : '/employee/dashboard'} replace />;
  return children;
};
