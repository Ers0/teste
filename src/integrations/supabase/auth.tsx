import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase/client';
import i18n from '@/i18n';
import { Profile } from '@/types';

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
    const fetchSessionAndProfile = async () => {
      setLoading(true);
      setProfileLoading(true);

      const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Error fetching session:', sessionError);
        setLoading(false);
        setProfileLoading(false);
        return;
      }

      setSession(initialSession);
      const currentUser = initialSession?.user || null;
      setUser(currentUser);

      if (currentUser) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, language')
          .eq('id', currentUser.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error fetching profile:', profileError);
        } else {
          setProfile(profileData as Profile);
          i18n.changeLanguage(profileData?.language || 'pt-BR');
        }
      } else {
        setProfile(null);
        i18n.changeLanguage('pt-BR');
      }

      setLoading(false);
      setProfileLoading(false);

      if (!initialSession?.user && location.pathname !== '/login') {
        navigate('/login');
      }
    };

    fetchSessionAndProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      const currentUser = session?.user || null;
      setUser(currentUser);
      setProfileLoading(true);

      if (currentUser) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, language')
          .eq('id', currentUser.id)
          .single();
        
        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error fetching profile on auth change:', profileError);
        } else {
          setProfile(profileData as Profile);
          i18n.changeLanguage(profileData?.language || 'pt-BR');
        }
      } else {
        setProfile(null);
        i18n.changeLanguage('pt-BR');
      }
      setProfileLoading(false);

      if (_event === 'SIGNED_OUT') {
        navigate('/login');
      } else if (_event === 'SIGNED_IN' && location.pathname === '/login') {
        navigate('/');
      }
    });

    return () => {
      subscription.unsubscribe();
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