import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganizations } from '@/hooks/useOrganizations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trophy, Loader2, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function OnboardingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { organizations, loading: orgLoading, hasFetchedForCurrentUser } = useOrganizations();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);

  // If user already has organizations, redirect to dashboard
  if (hasFetchedForCurrentUser && organizations.length > 0) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !orgName.trim()) return;

    setLoading(true);

    // 1. Create organization
    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName.trim(),
        slug: slug + '-' + Date.now().toString(36),
        subscription_tier: 'free',
      })
      .select()
      .single();

    if (orgError || !org) {
      toast({ title: 'Error', description: orgError?.message || 'Failed to create organization', variant: 'destructive' });
      setLoading(false);
      return;
    }

    // 2. Create owner membership
    const { error: memError } = await supabase
      .from('memberships')
      .insert({
        user_id: user.id,
        organization_id: org.id,
        role: 'owner',
      });

    if (memError) {
      toast({ title: 'Error', description: memError.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // 3. Create default help types
    await supabase.from('help_types').insert([
      { organization_id: org.id, name: 'Joker', effect: 'double', description: 'Doubles points + bonus points for the category' },
      { organization_id: org.id, name: 'Double Chance', effect: 'marker', description: 'Marker only, no score effect' },
    ]);

    localStorage.setItem('quizory-current-org', org.id);
    toast({ title: '✓', description: t('onboarding.success') });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 font-display font-bold text-xl">
            <Trophy className="h-6 w-6 text-primary" />
            Quizory
          </div>
          <LanguageSwitcher variant="ghost" />
        </div>

        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold">{t('onboarding.title')}</h1>
          <p className="text-muted-foreground">{t('onboarding.subtitle')}</p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">{t('onboarding.orgName')}</Label>
            <Input
              id="orgName"
              required
              maxLength={100}
              placeholder={t('onboarding.orgNamePlaceholder')}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="text-base"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading || !orgName.trim()}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('onboarding.cta')}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          {t('onboarding.note')}
        </p>
      </div>
    </div>
  );
}
