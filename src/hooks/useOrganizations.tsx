import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  subscription_tier: string;
  subscription_status: string | null;
  subscription_id: string | null;
  current_period_end: string | null;
  branding_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
  default_categories_count: number;
  default_questions_per_category: number;
  trial_ends_at: string | null;
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  organization_id: string;
  role: 'owner' | 'admin' | 'user';
  created_at: string;
}

interface OrganizationContextValue {
  organizations: Organization[];
  memberships: Membership[];
  currentOrg: Organization | null;
  currentRole: 'owner' | 'admin' | 'user' | null;
  loading: boolean;
  hasFetchedForCurrentUser: boolean;
  switchOrg: (orgId: string) => void;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [currentRole, setCurrentRole] = useState<'owner' | 'admin' | 'user' | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedForUserRef = useRef<string | null>(null);

  const fetchOrgs = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setMemberships([]);
      setCurrentOrg(null);
      setCurrentRole(null);
      fetchedForUserRef.current = null;
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: membershipData } = await supabase
      .from('memberships')
      .select('*')
      .eq('user_id', user.id) as { data: Membership[] | null };

    const mems = membershipData || [];
    setMemberships(mems);

    if (mems.length > 0) {
      const orgIds = mems.map((m) => m.organization_id);
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .in('id', orgIds) as { data: Organization[] | null };

      const orgs = orgData || [];
      setOrganizations(orgs);

      const savedOrgId = localStorage.getItem('quizory-current-org');
      const saved = orgs.find((o) => o.id === savedOrgId);
      const selected = saved || orgs[0];
      setCurrentOrg(selected);

      const mem = mems.find((m) => m.organization_id === selected.id);
      setCurrentRole(mem?.role ?? null);
    } else {
      setOrganizations([]);
      setCurrentOrg(null);
      setCurrentRole(null);
    }

    fetchedForUserRef.current = user.id;
    setLoading(false);
  }, [user]);

  useEffect(() => {
    setLoading(true);
    fetchOrgs();
  }, [fetchOrgs]);

  const switchOrg = useCallback((orgId: string) => {
    const org = organizations.find((o) => o.id === orgId);
    if (org) {
      setCurrentOrg(org);
      localStorage.setItem('quizory-current-org', orgId);
      const mem = memberships.find((m) => m.organization_id === orgId);
      setCurrentRole(mem?.role ?? null);
    }
  }, [organizations, memberships]);

  const hasFetchedForCurrentUser = !!user && fetchedForUserRef.current === user.id;

  return (
    <OrganizationContext.Provider value={{
      organizations,
      memberships,
      currentOrg,
      currentRole,
      loading,
      hasFetchedForCurrentUser,
      switchOrg,
      refetch: fetchOrgs,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizations() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) {
    throw new Error('useOrganizations must be used within OrganizationProvider');
  }
  return ctx;
}
