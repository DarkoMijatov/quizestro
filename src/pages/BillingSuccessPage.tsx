import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizations } from '@/hooks/useOrganizations';
import { isOrgPremium } from '@/lib/premium';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function BillingSuccessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentOrg, refetch } = useOrganizations();
  const [checking, setChecking] = useState(true);
  const search = new URLSearchParams(window.location.search);
  const transactionId = search.get('transaction_id') || '';
  const organizationId = search.get('organization_id') || currentOrg?.id || '';

  useEffect(() => {
    if (isOrgPremium(currentOrg)) {
      setChecking(false);
      navigate('/dashboard/pricing', { replace: true });
    }
  }, [currentOrg, navigate]);

  useEffect(() => {
    const confirm = async () => {
      if (!user || !transactionId || !organizationId) return;
      try {
        await supabase.functions.invoke('billing-confirm', {
          body: {
            transaction_id: transactionId,
            organization_id: organizationId,
          },
        });
      } catch (err) {
        console.error('Billing confirm error:', err);
      }
    };

    confirm();
  }, [user, transactionId, organizationId]);

  useEffect(() => {
    let tries = 0;
    const maxTries = 8;
    let timeoutId: number | undefined;

    const tick = async () => {
      await refetch();
      tries += 1;
      if (tries >= maxTries) {
        setChecking(false);
        return;
      }
      timeoutId = window.setTimeout(tick, 2500);
    };

    tick();
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [refetch]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
        </div>

        <h1 className="font-display text-2xl font-bold">Payment successful</h1>
        <p className="text-sm text-muted-foreground">
          {checking
            ? 'Your checkout was completed. Finalizing plan update...'
            : 'Checkout completed. If plan is still Free, webhook setup likely needs attention.'}
        </p>

        {user ? (
          <Button asChild className="w-full">
            <Link to="/dashboard/pricing">Back to billing</Link>
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link to="/login">Go to login</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
