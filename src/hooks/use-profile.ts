import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/integrations/supabase/auth';

export const useProfile = () => {
  const { user, profile, loading: authLoading, profileLoading } = useAuth(); // Get profile from useAuth
  const queryClient = useQueryClient();

  // The profile is now managed by SessionContextProvider.
  // This hook primarily provides access to it and the invalidate function.

  const invalidateProfile = () => {
    // Invalidate the query key that useProfile *used* to use,
    // in case other parts of the app still rely on it or if we reintroduce a query here.
    // The primary mechanism for profile updates will be through the SessionContextProvider's
    // onAuthStateChange listener, which will re-fetch the profile if the user's session updates.
    queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
  };

  return { profile, isLoading: authLoading || profileLoading, error: null, invalidateProfile };
};