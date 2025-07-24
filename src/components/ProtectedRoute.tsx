import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/integrations/supabase/auth';
import { useIntl } from 'react-intl';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const intl = useIntl();

  if (loading) {
    // Show a loading indicator while authentication status is being determined
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-400">{intl.formatMessage({ id: 'loading_application' })}</p>
      </div>
    );
  }

  if (!user) {
    // If not authenticated, redirect to the login page
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the children (the protected page)
  return <>{children}</>;
};

export default ProtectedRoute;