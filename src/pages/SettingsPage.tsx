import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Zap, Crown, Shield, Upload, Palette, Sun, Moon } from 'lucide-react';

interface HelpType {
  id: string;
  name: string;
  description: string | null;
  effect: string;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { currentOrg, currentRole, refetch } = useOrganizations();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [orgName, setOrgName] = useState('');
  const [defaultCats, setDefaultCats] = useState(6);
  const [defaultQpc, setDefaultQpc] = useState(10);
  const [brandingColor, setBrandingColor] = useState('#d97706');
  const [secondaryColor, setSecondaryColor] = useState('#3b82f6');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Help types
  const [helpTypes, setHelpTypes] = useState<HelpType[]>([]);
  const [jokerEnabled, setJokerEnabled] = useState(false);
  const [doubleChanceEnabled, setDoubleChanceEnabled] = useState(false);
  const [helpLoading, setHelpLoading] = useState(true);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const isOwner = currentRole === 'owner';
  const canEdit = currentRole === 'owner' || currentRole === 'admin';
  const isFree = currentOrg?.subscription_tier === 'free';
  const isPremium = currentOrg?.subscription_tier === 'premium';
  const isTrial = currentOrg?.subscription_tier === 'trial';

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name || '');
      setDefaultCats(currentOrg.default_categories_count ?? 6);
      setDefaultQpc(currentOrg.default_questions_per_category ?? 10);
      setBrandingColor(currentOrg.branding_color || '#d97706');
      setSecondaryColor(currentOrg.secondary_color || '#3b82f6');
      setLogoUrl(currentOrg.logo_url || null);
    }
  }, [currentOrg]);

  useEffect(() => {
    if (!currentOrg) return;
    const loadHelps = async () => {
      setHelpLoading(true);
      const { data } = await supabase
        .from('help_types')
        .select('*')
        .eq('organization_id', currentOrg.id);
      const helps = (data || []) as HelpType[];
      setHelpTypes(helps);
      setJokerEnabled(helps.some(h => h.name.toLowerCase() === 'joker'));
      setDoubleChanceEnabled(helps.some(h => h.name.toLowerCase() === 'double chance'));
      setHelpLoading(false);
    };
    loadHelps();
  }, [currentOrg?.id]);

  const toggleHelp = async (name: string, enabled: boolean) => {
    if (!currentOrg) return;
    if (enabled) {
      const effect = name.toLowerCase() === 'joker' ? 'double' : 'second_chance';
      await supabase.from('help_types').insert({
        name,
        effect,
        organization_id: currentOrg.id,
        description: name.toLowerCase() === 'joker' ? 'Duplira poene za jednu kategoriju' : 'Omogućava dva odgovora po pitanju u jednoj kategoriji',
      });
    } else {
      const help = helpTypes.find(h => h.name.toLowerCase() === name.toLowerCase());
      if (help) await supabase.from('help_types').delete().eq('id', help.id);
    }
    // Refresh
    const { data } = await supabase.from('help_types').select('*').eq('organization_id', currentOrg.id);
    const helps = (data || []) as HelpType[];
    setHelpTypes(helps);
    setJokerEnabled(helps.some(h => h.name.toLowerCase() === 'joker'));
    setDoubleChanceEnabled(helps.some(h => h.name.toLowerCase() === 'double chance'));
    toast({ title: '✓', description: t('settings.saved') });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentOrg) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${currentOrg.id}/logo.${ext}`;
    
    await supabase.storage.from('org-logos').upload(path, file, { upsert: true });
    const { data: urlData } = supabase.storage.from('org-logos').getPublicUrl(path);
    
    await supabase.from('organizations').update({ logo_url: urlData.publicUrl }).eq('id', currentOrg.id);
    setLogoUrl(urlData.publicUrl);
    await refetch();
    setUploading(false);
    toast({ title: '✓', description: t('settings.saved') });
  };

  const handleSave = async () => {
    if (!currentOrg || !orgName.trim()) return;
    setSaving(true);
    const updates: any = {
      name: orgName.trim(),
      default_categories_count: defaultCats,
      default_questions_per_category: defaultQpc,
    };
    if (isOwner) {
      updates.branding_color = brandingColor;
      updates.secondary_color = secondaryColor;
    }
    await supabase.from('organizations').update(updates).eq('id', currentOrg.id);
    await refetch();
    toast({ title: '✓', description: t('settings.saved') });
    setSaving(false);
  };

  const trialDaysLeft = currentOrg?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(currentOrg.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="font-display text-2xl font-bold">{t('settings.title')}</h1>

        {/* Subscription card */}
        <div className="rounded-xl border-2 border-primary/20 bg-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isPremium ? (
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
              ) : isTrial ? (
                <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                  <Shield className="h-5 w-5 text-accent-foreground" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Zap className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{t('settings.subscription')}</p>
                  <Badge variant={isPremium ? 'default' : 'secondary'}>
                    {isPremium ? 'Premium' : isTrial ? 'Trial' : 'Free'}
                  </Badge>
                </div>
                {isTrial && trialDaysLeft > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('settings.trialDaysLeft', { days: trialDaysLeft })}
                  </p>
                )}
                {isFree && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('settings.freeDescription')}
                  </p>
                )}
              </div>
            </div>
            {!isPremium && (
              <Button size="sm" className="gap-1">
                <Zap className="h-3 w-3" />
                {t('freemium.upgrade')}
              </Button>
            )}
          </div>

          {isFree && (
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-lg font-bold">1</p>
                <p className="text-xs text-muted-foreground">{t('settings.maxOrgs')}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-lg font-bold">10</p>
                <p className="text-xs text-muted-foreground">{t('settings.quizzesTotal')}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-lg font-bold">1</p>
                <p className="text-xs text-muted-foreground">{t('settings.maxMembers')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Organization settings */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h2 className="font-display font-semibold">{t('settings.orgSettings')}</h2>

          <div className="space-y-2">
            <Label>{t('settings.orgName')}</Label>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!canEdit} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('settings.defaultCategories')}</Label>
              <Input type="number" min={1} max={20} value={defaultCats} onChange={(e) => setDefaultCats(Number(e.target.value))} disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.defaultQuestionsPerCategory')}</Label>
              <Input type="number" min={1} max={50} value={defaultQpc} onChange={(e) => setDefaultQpc(Number(e.target.value))} disabled={!canEdit} />
            </div>
          </div>

          {canEdit && (
            <Button onClick={handleSave} disabled={saving || !orgName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          )}
        </div>

        {/* Branding (Owner only) */}
        {isOwner && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <h2 className="font-display font-semibold">{t('settings.branding')}</h2>
            </div>

            {/* Logo */}
            <div className="space-y-2">
              <Label>{t('settings.logo')}</Label>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {t('settings.uploadLogo')}
                  </Button>
                </div>
              </div>
            </div>

            {/* Colors */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.primaryColor')}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandingColor}
                    onChange={(e) => setBrandingColor(e.target.value)}
                    className="h-10 w-10 rounded cursor-pointer border border-border"
                  />
                  <Input value={brandingColor} onChange={(e) => setBrandingColor(e.target.value)} className="font-mono text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('settings.secondaryColor')}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-10 rounded cursor-pointer border border-border"
                  />
                  <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono text-sm" />
                </div>
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        )}

        {/* Help Types */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <h2 className="font-display font-semibold">{t('settings.helpTypes')}</h2>
          <p className="text-sm text-muted-foreground">{t('settings.helpTypesDescription')}</p>

          {helpLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Joker</p>
                  <p className="text-xs text-muted-foreground">{t('settings.jokerDescription')}</p>
                </div>
                <Switch
                  checked={jokerEnabled}
                  onCheckedChange={(v) => { setJokerEnabled(v); toggleHelp('Joker', v); }}
                  disabled={!canEdit}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="font-medium">Double Chance</p>
                  <p className="text-xs text-muted-foreground">{t('settings.doubleChanceDescription')}</p>
                </div>
                <Switch
                  checked={doubleChanceEnabled}
                  onCheckedChange={(v) => { setDoubleChanceEnabled(v); toggleHelp('Double Chance', v); }}
                  disabled={!canEdit}
                />
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle (Owner only) */}
        {isOwner && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2">
              {isDark ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
              <h2 className="font-display font-semibold">{t('settings.theme')}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{t('settings.themeDescription')}</p>
            <div className="flex items-center gap-4">
              <Button
                variant={!isDark ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => {
                  document.documentElement.classList.remove('dark');
                  localStorage.setItem('quizory-theme', 'light');
                  setIsDark(false);
                }}
              >
                <Sun className="h-4 w-4" /> {t('settings.lightTheme')}
              </Button>
              <Button
                variant={isDark ? 'default' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => {
                  document.documentElement.classList.add('dark');
                  localStorage.setItem('quizory-theme', 'dark');
                  setIsDark(true);
                }}
              >
                <Moon className="h-4 w-4" /> {t('settings.darkTheme')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
