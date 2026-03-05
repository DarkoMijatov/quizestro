import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useOrganizations } from '@/hooks/useOrganizations';
import { isOrgPremium } from '@/lib/premium';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, Crown, Loader2, ArrowDownCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function PricingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg, currentRole, refetch } = useOrganizations();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const isOwner = currentRole === 'owner';
  const isPremium = isOrgPremium(currentOrg);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const handleCheckout = async (variant: 'monthly' | 'annual') => {
    if (!currentOrg || !isOwner) return;
    setLoading(variant);
    try {
      const { data, error } = await supabase.functions.invoke('billing-checkout', {
        body: { organization_id: currentOrg.id, variant_id: variant },
      });
      if (error) throw error;
      if (data?.checkout_url) {
        const checkoutUrl = new URL(data.checkout_url);
        if (data?.transaction_id && !checkoutUrl.searchParams.has('transaction_id')) {
          checkoutUrl.searchParams.set('transaction_id', data.transaction_id);
        }
        if (!checkoutUrl.searchParams.has('organization_id')) {
          checkoutUrl.searchParams.set('organization_id', currentOrg.id);
        }
        window.location.href = checkoutUrl.toString();
      } else {
        throw new Error('No checkout URL');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast({ title: t('common.error', 'Error'), description: err.message || 'Failed to start checkout', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleDowngrade = async () => {
    if (!currentOrg || !isOwner) return;
    setLoading('downgrade');
    try {
      const { data, error } = await supabase.functions.invoke('billing-cancel', {
        body: { organization_id: currentOrg.id },
      });
      if (error) throw error;
      toast({ title: t('pricing.downgradeSuccess') });
      refetch();
    } catch (err: any) {
      console.error('Downgrade error:', err);
      toast({ title: t('common.error', 'Error'), description: err.message || 'Failed to cancel subscription', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      key: 'free',
      name: t('pricing.free.name', 'Free'),
      price: t('pricing.free.priceDisplay', '€0'),
      period: t('pricing.free.period', '/mo'),
      features: (t('pricing.free.features', { returnObjects: true }) as string[]),
      current: !isPremium,
    },
    {
      key: 'monthly',
      name: t('pricing.premium.name', 'Pro'),
      price: t('pricing.premium.priceDisplay', '€9.99'),
      period: '/' + t('pricing.month', 'mo'),
      popular: true,
      features: (t('pricing.premium.features', { returnObjects: true }) as string[]),
      current: isPremium,
    },
    {
      key: 'annual',
      name: t('pricing.annual.name', 'Pro Annual'),
      price: t('pricing.annual.priceDisplay', '€99'),
      period: '/' + t('pricing.year', 'yr'),
      badge: t('pricing.save2months'),
      features: (t('pricing.premium.features', { returnObjects: true }) as string[]),
      current: false,
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-bold">{t('pricing.title')}</h1>
          <p className="text-muted-foreground">{t('pricing.subtitle')}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`relative rounded-xl border-2 p-6 flex flex-col ${
                plan.popular ? 'border-primary shadow-lg shadow-primary/10' : 'border-border'
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  {t('pricing.premium.popular')}
                </Badge>
              )}
              {plan.badge && (
                <Badge variant="secondary" className="absolute -top-3 right-4">
                  {plan.badge}
                </Badge>
              )}

              <div className="mb-6">
                <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 flex-1 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.key === 'free' ? (
                isPremium && isOwner ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full gap-2" disabled={loading !== null}>
                        {loading === 'downgrade' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownCircle className="h-4 w-4" />}
                        {t('pricing.downgrade')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('pricing.downgrade')}</AlertDialogTitle>
                        <AlertDialogDescription>{t('pricing.downgradeConfirm')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDowngrade}>{t('common.confirm')}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button variant="outline" disabled={plan.current} className="w-full">
                    {plan.current ? t('pricing.currentPlan') : t('pricing.free.cta')}
                  </Button>
                )
              ) : (
                <Button
                  className="w-full gap-2"
                  variant={plan.popular ? 'default' : 'outline'}
                  disabled={!isOwner || isPremium || loading !== null}
                  onClick={() => handleCheckout(plan.key as 'monthly' | 'annual')}
                >
                  {loading === plan.key ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Crown className="h-4 w-4" />
                  )}
                  {isPremium ? t('pricing.currentPlan') : t('pricing.premium.cta')}
                </Button>
              )}

              {!isOwner && plan.key !== 'free' && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {t('pricing.ownerOnly')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
