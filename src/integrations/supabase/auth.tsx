import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import i18n from '@/i18n';

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  language: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true); // Overall loading for auth state
  const [profileLoading, setProfileLoading] = useState(true); // Loading specifically for profile data
  const navigate = useNavigate();
  const location = useLocation();
  const isInitialLoad = useRef(true); // Use a ref to track initial load

  useEffect(() => {
    console.log('SessionContextProvider: Setting up auth state listener.');

    const handleAuthChange = async (event: string, currentSession: Session | null) => {
      console.log('Auth State Change Event:', event, 'Session:', currentSession);
      setSession(currentSession);
      setUser(currentSession?.user || null);

      if (currentSession?.user) {
        setProfileLoading(true);
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, language')
            .eq('id', currentSession.user.id)
            .limit(1)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError);
            setProfile(null);
          } else {
            setProfile(profileData || null);
            i18n.changeLanguage(profileData?.language || 'en');
          }
        } catch (err) {
          console.error('Unexpected error during profile fetch:', err);
          setProfile(null);
        } finally {
          setProfileLoading(false);
        }

        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_LOAD') && location.pathname === '/login') {
          console.log('User signed in or updated, navigating from login to /');
          navigate('/');
        }
      } else {
        setProfile(null);
        setProfileLoading(false);
        i18n.changeLanguage('en');
        if ((event === 'SIGNED_OUT' || event === 'INITIAL_LOAD') && location.pathname !== '/login') {
          console.log('User signed out, navigating to /login');
          navigate('/login');
        }
      }

      // Only set loading to false after the very first auth state change or initial session check
      if (isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
    };

    // Set up the listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Perform initial session check immediately
    const checkInitialSession = async () => {
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        console.log('Initial getSession result:', currentSession, 'Error:', sessionError);
        // Manually trigger the handler for the initial session
        await handleAuthChange('INITIAL_LOAD', currentSession); // Use a custom event type for initial load
      } catch (err) {
        console.error('Unexpected error during initial session check:', err);
        // Ensure loading is false even if initial check fails
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
        setLoading(false); // Ensure loading is false on error
        if (location.pathname !== '/login') {
          navigate('/login');
        }
      }
    };

    if (isInitialLoad.current) { // Only run initial check once
      checkInitialSession();
    }

    return () => {
      console.log('SessionContextProvider: Unsubscribing from auth state listener.');
      subscription.unsubscribe();
    };
  }, [navigate, location.pathname]); // Dependencies remain the same

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, profileLoading }}>
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