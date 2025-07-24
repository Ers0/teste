import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import i18n from '@/i18n';
import { syncAllData } from '@/lib/sync';
import { db, Profile } from '@/lib/db';

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
  const location = useLocation();

  useEffect(() => {
    const updateAuthStates = async (currentSession: Session | null) => {
      setSession(currentSession);
      setUser(currentSession?.user || null);

      if (currentSession?.user) {
        setProfileLoading(true);
        try {
          let profileData: Profile | null = null;
          if (navigator.onLine) {
            await syncAllData(currentSession.user.id);
            const { data, error } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, language')
              .eq('id', currentSession.user.id)
              .limit(1)
              .single();
            if (error && error.code !== 'PGRST116') throw error;
            profileData = data;
          } else {
            console.log("Offline: Attempting to fetch profile from local DB.");
            profileData = await db.profiles.get(currentSession.user.id) || null;
          }
          setProfile(profileData);
          i18n.changeLanguage(profileData?.language || 'pt-BR');
        } catch (err) {
          console.error('Error during profile fetch:', err);
          setProfile(null);
        } finally {
          setProfileLoading(false);
        }
      } else {
        setProfile(null);
        setProfileLoading(false);
        i18n.changeLanguage('pt-BR');
      }
    };

    const setupAuth = async () => {
      setLoading(true);
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        await updateAuthStates(initialSession);

        if (!initialSession?.user && navigator.onLine && location.pathname !== '/login') {
          navigate('/login');
        }
      } catch (err) {
        console.error('Error during initial session check:', err);
        if (navigator.onLine && location.pathname !== '/login') {
          navigate('/login');
        }
      } finally {
        setLoading(false);
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        await updateAuthStates(currentSession);

        if (event === 'SIGNED_OUT') {
          await db.delete().then(() => db.open()); // Clear local DB on logout
          if (navigator.onLine) {
            navigate('/login');
          }
        } else if (event === 'SIGNED_IN' && location.pathname === '/login') {
          navigate('/');
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    };

    const cleanupPromise = setupAuth();

    return () => {
      cleanupPromise.then(cleanup => cleanup && cleanup());
    };
  }, [navigate, location.pathname]);

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