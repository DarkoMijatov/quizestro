import { Navigate } from 'react-router-dom';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

/** Wraps dashboard routes — redirects to onboarding if user has no org */
export function RequireOrganization({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { organizations, loading: orgLoading } = useOrganizations();

  if (authLoading || orgLoading) {
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

  return <>{children}</>;
}
