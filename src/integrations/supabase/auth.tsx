import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
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
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('SessionContextProvider: Initializing auth state listener.');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth State Change Event:', event, 'Session:', currentSession);
      setSession(currentSession);
      setUser(currentSession?.user || null);
      // setLoading(false); // Moved to finally block for initial check

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

        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          console.log('User signed in or updated, navigating to /');
          navigate('/');
        }
      } else {
        setProfile(null);
        setProfileLoading(false);
        i18n.changeLanguage('en');
        if (event === 'SIGNED_OUT') {
          console.log('User signed out, navigating to /login');
          navigate('/login');
        }
      }
    });

    // Initial session check
    const checkInitialSession = async () => {
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        console.log('Initial getSession result:', currentSession, 'Error:', sessionError);

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
              console.error('Error fetching initial profile:', profileError);
              setProfile(null);
            } else {
              setProfile(profileData || null);
              i18n.changeLanguage(profileData?.language || 'en');
            }
          } catch (err) {
            console.error('Unexpected error during initial profile fetch:', err);
            setProfile(null);
          } finally {
            setProfileLoading(false);
          }
        } else {
          setProfile(null);
          setProfileLoading(false);
          i18n.changeLanguage('en');
          console.log('No initial session found, navigating to /login');
          navigate('/login');
        }
      } catch (err) {
        console.error('Unexpected error during initial session check:', err);
        setSession(null);
        setUser(null);
        setProfile(null);
        setProfileLoading(false);
        i18n.changeLanguage('en');
        navigate('/login'); // Ensure navigation even on unexpected errors
      } finally {
        setLoading(false); // Ensure overall loading is set to false
      }
    };

    checkInitialSession();

    return () => {
      console.log('SessionContextProvider: Unsubscribing from auth state listener.');
      subscription.unsubscribe();
    };
  }, [navigate]);

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