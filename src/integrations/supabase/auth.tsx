import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import i18n from '@/i18n'; // Import i18n

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  language: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null; // Add profile to context
  loading: boolean; // Overall loading for auth and initial profile fetch
  profileLoading: boolean; // Specific loading for profile
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SessionContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null); // State for profile
  const [loading, setLoading] = useState(true); // Overall loading for auth and initial profile fetch
  const [profileLoading, setProfileLoading] = useState(true); // Specific loading for profile
  const navigate = useNavigate();

  useEffect(() => {
    console.log('SessionContextProvider: Initializing auth state listener.');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth State Change Event:', event, 'Session:', currentSession);
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setLoading(false); // Auth state is resolved

      if (currentSession?.user) {
        // User is logged in, fetch profile
        setProfileLoading(true);
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, language')
          .eq('id', currentSession.user.id)
          .limit(1)
          .single(); // Use single to get object directly or null/error

        if (profileError && profileError.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine for new users
          console.error('Error fetching profile:', profileError);
          setProfile(null);
        } else {
          setProfile(profileData || null);
          // Set language from profile or default to 'en'
          i18n.changeLanguage(profileData?.language || 'en');
        }
        setProfileLoading(false);

        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          console.log('User signed in or updated, navigating to /');
          navigate('/'); // Redirect authenticated users to the main page
        }
      } else {
        // User is signed out or no user
        setProfile(null);
        setProfileLoading(false);
        i18n.changeLanguage('en'); // Reset language to default on sign out
        if (event === 'SIGNED_OUT') {
          console.log('User signed out, navigating to /login');
          navigate('/login'); // Redirect unauthenticated users to the login page
        }
      }
    });

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      console.log('Initial getSession result:', currentSession);
      setSession(currentSession);
      setUser(currentSession?.user || null);
      setLoading(false); // Auth state is resolved

      if (currentSession?.user) {
        setProfileLoading(true);
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
        setProfileLoading(false);
      } else {
        setProfile(null);
        setProfileLoading(false);
        i18n.changeLanguage('en');
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