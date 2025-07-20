import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/integrations/supabase/auth';

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  language: string | null;
}

export const useProfile = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile, isLoading, error } = useQuery<Profile | null, Error>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, language')
        .eq('id', user.id)
        .limit(1);

      if (error) {
        throw new Error(error.message);
      }

      return data && data.length > 0 ? data[0] : null;
    },
    enabled: !!user && !authLoading, // Only run query if user is logged in and auth is not loading
    staleTime: 1000 * 60 * 5, // Data considered fresh for 5 minutes
  });

  const invalidateProfile = () => {
    queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
  };

  return { profile, isLoading: isLoading || authLoading, error, invalidateProfile };
};