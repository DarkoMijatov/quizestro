import { Navigate } from 'react-router-dom';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

/** Wraps dashboard routes — redirects to onboarding if user has no org */
export function RequireOrganization({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { organizations, loading: orgLoading, hasFetchedForCurrentUser } = useOrganizations();

  // Show loader while auth or orgs are loading, OR if we have a user but haven't fetched orgs for them yet
  if (authLoading || orgLoading || (user && !hasFetchedForCurrentUser)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (organizations.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  // Multiple orgs, no saved preference → show org picker
  if (organizations.length > 1) {
    const savedOrgId = localStorage.getItem('quizory-current-org');
    if (!savedOrgId || !organizations.some(o => o.id === savedOrgId)) {
      return <Navigate to="/onboarding" replace />;
    }
  }

  return <>{children}</>;
}
