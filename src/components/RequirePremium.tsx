import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Lock, Zap } from 'lucide-react';

export function RequirePremium({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg } = useOrganizations();
  const isPremium = currentOrg?.subscription_tier === 'premium' || currentOrg?.subscription_tier === 'trial';

  if (!isPremium) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">{t('freemium.premiumFeature')}</h2>
          <p className="text-muted-foreground max-w-md mb-6">{t('freemium.premiumDescription')}</p>
          <Button className="gap-2" onClick={() => navigate('/dashboard/pricing')}>
            <Zap className="h-4 w-4" />
            {t('freemium.upgrade')}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return <>{children}</>;
}
