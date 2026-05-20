import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from './ProtectedRoute';

interface ClubProtectedRouteProps {
  children: React.ReactNode;
}

const ClubProtectedRoute: React.FC<ClubProtectedRouteProps> = ({ children }) => {
  const { hasClubAccess, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasClubAccess) {
    return <Navigate to="/library" replace />;
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
};

export default ClubProtectedRoute;
