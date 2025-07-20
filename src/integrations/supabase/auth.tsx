import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client'; // Import the single supabase client

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('SessionContextProvider: Initializing auth state listener.');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth State Change Event:', event, 'Session:', currentSession);
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setLoading(false);

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (currentSession) {
          console.log('User signed in or updated, navigating to /');
          navigate('/'); // Redirect authenticated users to the main page
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out, navigating to /login');
        navigate('/login'); // Redirect unauthenticated users to the login page
      }
    });

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log('Initial getSession result:', currentSession);
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setLoading(false);
      if (!currentSession) {
        console.log('No initial session found, navigating to /login');
        navigate('/login');
      }
    });

    return () => {
      console.log('SessionContextProvider: Unsubscribing from auth state listener.');
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within a SessionContextProvider');
  }
  return context;
};