import type { Organization } from '@/hooks/useOrganizations';

/** Check if the organization has active premium access (subscription, trial, or gift code override). */
export function isOrgPremium(org: Organization | null | undefined): boolean {
  if (!org) return false;
  if (org.subscription_tier === 'premium' || org.subscription_tier === 'trial') return true;
  if (org.premium_override) {
    // If override has no expiry, it's unlimited
    if (!org.premium_override_until) return true;
    // Check if override hasn't expired
    return new Date(org.premium_override_until) > new Date();
  }
  return false;
}
