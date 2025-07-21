import React, { createContext, useContext, useEffect, useState } from 'react';
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

  useEffect(() => {
    console.log('SessionContextProvider: Initializing auth state listener.');

    // Function to handle session and profile updates
    const updateAuthStates = async (currentSession: Session | null) => {
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
      } else {
        setProfile(null);
        setProfileLoading(false);
        i18n.changeLanguage('en');
      }
    };

    // Function to perform initial session check and setup
    const setupAuth = async () => {
      setLoading(true); // Start overall loading
      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        console.log('Initial getSession result:', initialSession, 'Error:', sessionError);

        await updateAuthStates(initialSession); // Update states based on initial session

        // Handle initial navigation based on session
        if (initialSession?.user) {
          if (location.pathname === '/login') {
            console.log('Initial session found, navigating from login to /');
            navigate('/');
          }
        } else {
          if (location.pathname !== '/login') {
            console.log('No initial session found, navigating to /login');
            navigate('/login');
          }
        }
      } catch (err) {
        console.error('Unexpected error during initial session check:', err);
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
        if (location.pathname !== '/login') {
          navigate('/login');
        }
      } finally {
        setLoading(false); // Always set overall loading to false after initial check
      }

      // Set up the real-time listener for subsequent changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
        console.log('Auth State Change Event (from listener):', event, 'Session:', currentSession);
        updateAuthStates(currentSession); // Update states for ongoing changes

        // Handle navigation for ongoing changes
        if (currentSession?.user) {
          if (location.pathname === '/login') {
            console.log('User signed in or updated, navigating from login to /');
            navigate('/');
          }
        } else {
          if (location.pathname !== '/login') {
            console.log('User signed out, navigating to /login');
            navigate('/login');
          }
        }
      });

      return () => {
        console.log('SessionContextProvider: Unsubscribing from auth state listener.');
        subscription.unsubscribe();
      };
    };

    const cleanup = setupAuth(); // Call the setup function and capture its cleanup

    return () => {
      cleanup.then(unsubscribe => unsubscribe()); // Ensure unsubscribe is called
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