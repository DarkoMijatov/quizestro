import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { isOrgPremium } from '@/lib/premium';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, Zap, Crown, Shield, Upload, Palette, Sun, Moon, ArrowDownCircle, CreditCard, CalendarDays, Receipt, KeyRound, Gift } from 'lucide-react';
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

interface HelpType {
  id: string;
  name: string;
  description: string | null;
  effect: string;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg, currentRole, refetch } = useOrganizations();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [orgName, setOrgName] = useState('');
  const [defaultCats, setDefaultCats] = useState(6);
  const [defaultQpc, setDefaultQpc] = useState(10);
  const [brandingColor, setBrandingColor] = useState('#d97706');
  const [secondaryColor, setSecondaryColor] = useState('#3b82f6');
  const [bgColor, setBgColor] = useState('');
  const [textColor, setTextColor] = useState('');
  const [headerColor, setHeaderColor] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  // Change password
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Gift code
  const [giftCode, setGiftCode] = useState('');
  const [giftLoading, setGiftLoading] = useState(false);

  // Help types
  const [helpTypes, setHelpTypes] = useState<HelpType[]>([]);
  const [jokerEnabled, setJokerEnabled] = useState(false);
  const [doubleChanceEnabled, setDoubleChanceEnabled] = useState(false);
  const [helpLoading, setHelpLoading] = useState(true);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const isOwner = currentRole === 'owner';
  const canEdit = currentRole === 'owner' || currentRole === 'admin';
  const isFree = currentOrg?.subscription_tier === 'free';
  const isPremium = isOrgPremium(currentOrg);
  const isTrial = currentOrg?.subscription_tier === 'trial';
  const hasPermanentGift = !!(currentOrg?.premium_override && !currentOrg?.premium_override_until);

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name || '');
      setDefaultCats(currentOrg.default_categories_count ?? 6);
      setDefaultQpc(currentOrg.default_questions_per_category ?? 10);
      setBrandingColor(currentOrg.branding_color || '#d97706');
      setSecondaryColor(currentOrg.secondary_color || '#3b82f6');
      setBgColor(currentOrg.branding_bg_color || '');
      setTextColor(currentOrg.branding_text_color || '');
      setHeaderColor(currentOrg.branding_header_color || '');
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
      updates.branding_bg_color = bgColor || null;
      updates.branding_text_color = textColor || null;
      updates.branding_header_color = headerColor || null;
    }
    await supabase.from('organizations').update(updates).eq('id', currentOrg.id);
    await refetch();
    toast({ title: '✓', description: t('settings.saved') });
    setSaving(false);
  };

  const handleDowngrade = async () => {
    if (!currentOrg || !isOwner) return;
    setLoading('downgrade');
    try {
      const { error } = await supabase.functions.invoke('billing-cancel', {
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: 'Error', description: t('settings.passwordTooShort'), variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast({ title: 'Error', description: t('settings.passwordMismatch'), variant: 'destructive' });
      return;
    }
    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✓', description: t('settings.passwordChanged') });
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };

  const handleRedeemGiftCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !giftCode.trim()) return;
    setGiftLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('redeem-gift-code', {
        body: { code: giftCode.trim(), organization_id: currentOrg.id },
      });
      if (error) {
        // Try to parse the error body for a user-friendly message
        const errorBody = typeof error === 'object' && 'context' in error
          ? await (error as any).context?.json?.().catch(() => null)
          : null;
        const message = errorBody?.error || data?.error || error.message || 'Failed to redeem code';
        toast({ title: '✗', description: message, variant: 'destructive' });
      } else if (data?.error) {
        toast({ title: '✗', description: data.error, variant: 'destructive' });
      } else {
        const desc = data.duration_days
          ? t('settings.giftCodeAppliedDays', { days: data.duration_days })
          : t('settings.giftCodeAppliedForever');
        toast({ title: '🎁', description: desc });
        setGiftCode('');
        await refetch();
      }
    } catch (err: any) {
      toast({ title: '✗', description: err.message || 'Failed to redeem code', variant: 'destructive' });
    } finally {
      setGiftLoading(false);
    }
  };

  const trialDaysLeft = currentOrg?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(currentOrg.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="font-display text-2xl font-bold">{t('settings.title')}</h1>

        {hasPermanentGift ? (
          /* Permanent gift code - simple Pro status display */
          <div className="rounded-xl border-2 border-primary/20 bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <h2 className="font-display font-semibold text-lg">{t('settings.manageSubscription')}</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{t('settings.currentPlan')}</p>
                  <Badge variant="default">{t('settings.planPremium')}</Badge>
                  <Badge variant="outline" className="text-xs">{t('settings.statusActive')}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {currentOrg?.premium_override_reason || t('settings.giftCodeAppliedForever')}
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Normal subscription management */
          <>
            <div className="rounded-xl border-2 border-primary/20 bg-card p-6 space-y-5">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="font-display font-semibold text-lg">{t('settings.manageSubscription')}</h2>
              </div>

              {/* Current plan row */}
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
                      <p className="font-semibold">{t('settings.currentPlan')}</p>
                      <Badge variant={isPremium ? 'default' : 'secondary'}>
                        {isPremium ? t('settings.planPremium') : isTrial ? t('settings.planTrial') : t('settings.planFree')}
                      </Badge>
                      {(isPremium || isTrial) && currentOrg?.subscription_status && (
                        <Badge variant={currentOrg.subscription_status === 'cancelled' ? 'destructive' : 'outline'} className="text-xs">
                          {currentOrg.subscription_status === 'cancelled' ? t('settings.statusCancelled') : t('settings.statusActive')}
                        </Badge>
                      )}
                    </div>
                    {isFree && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t('settings.freeDescription')}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Plan details */}
              {(isPremium || isTrial) && (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                  {isPremium && currentOrg?.current_period_end && (
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {currentOrg.subscription_status === 'cancelled'
                          ? t('settings.accessUntil')
                          : t('settings.renewsOn')}:
                      </span>
                      <span className="font-medium">
                        {new Date(currentOrg.current_period_end).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {isTrial && currentOrg?.trial_ends_at && (
                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{t('settings.billingStartsOn')}:</span>
                      <span className="font-medium">
                        {new Date(currentOrg.trial_ends_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {isTrial && trialDaysLeft > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t('settings.trialDaysLeft', { days: trialDaysLeft })}
                    </p>
                  )}
                </div>
              )}

              {/* Free plan limits */}
              {isFree && (
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-lg font-bold">1</p>
                    <p className="text-xs text-muted-foreground">{t('settings.maxOrgs')}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-lg font-bold">20</p>
                    <p className="text-xs text-muted-foreground">{t('settings.quizzesTotal')}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-lg font-bold">1</p>
                    <p className="text-xs text-muted-foreground">{t('settings.maxMembers')}</p>
                  </div>
                </div>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                {!isPremium && !isTrial && (
                  <Button className="gap-2" onClick={() => navigate('/dashboard/pricing')}>
                    <Zap className="h-4 w-4" />
                    {t('freemium.upgrade')}
                  </Button>
                )}
                {(isPremium || isTrial) && isOwner && (
                  <Button variant="outline" className="gap-2" onClick={() => navigate('/dashboard/pricing')}>
                    {t('settings.changePlan')}
                  </Button>
                )}
                {(isPremium || isTrial) && isOwner && currentOrg?.subscription_status !== 'cancelled' && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={loading !== null}>
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
                )}
                {!isOwner && (isPremium || isTrial) && (
                  <p className="text-xs text-muted-foreground">{t('pricing.ownerOnly')}</p>
                )}
              </div>

              <Separator />

              {/* Payment history */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">{t('settings.paymentHistory')}</h3>
                </div>
                <div className="rounded-lg border border-border p-4 text-center">
                  <p className="text-sm text-muted-foreground">{t('settings.noPayments')}</p>
                </div>
              </div>
            </div>

            {/* Gift Code Redeem */}
            {isOwner && (
              <div className="rounded-xl border border-border bg-card p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-primary" />
                  <h2 className="font-display font-semibold">{t('settings.giftCode')}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{t('settings.giftCodeDescription')}</p>
                <form onSubmit={handleRedeemGiftCode} className="flex gap-3 max-w-sm">
                  <Input
                    value={giftCode}
                    onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
                    placeholder={t('settings.giftCodePlaceholder')}
                    className="font-mono tracking-wider uppercase"
                    required
                  />
                  <Button type="submit" disabled={giftLoading || !giftCode.trim()}>
                    {giftLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {t('settings.redeemCode')}
                  </Button>
                </form>
              </div>
            )}
          </>
        )}
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

            {/* Pro-only branding: bg, text, header colors */}
            {(isPremium || isTrial) ? (
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('settings.bgColor')}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bgColor || '#1a1a2e'}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="h-10 w-10 rounded cursor-pointer border border-border"
                    />
                    <Input value={bgColor} onChange={(e) => setBgColor(e.target.value)} placeholder="#1a1a2e" className="font-mono text-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.textColor')}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={textColor || '#ffffff'}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="h-10 w-10 rounded cursor-pointer border border-border"
                    />
                    <Input value={textColor} onChange={(e) => setTextColor(e.target.value)} placeholder="#ffffff" className="font-mono text-sm" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('settings.headerColor')}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={headerColor || '#2a2a4a'}
                      onChange={(e) => setHeaderColor(e.target.value)}
                      className="h-10 w-10 rounded cursor-pointer border border-border"
                    />
                    <Input value={headerColor} onChange={(e) => setHeaderColor(e.target.value)} placeholder="#2a2a4a" className="font-mono text-sm" />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">{t('settings.brandingProOnly')}</p>
            )}

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

        {/* Change Password */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h2 className="font-display font-semibold">{t('settings.changePassword')}</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label>{t('settings.newPassword')}</Label>
              <Input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.confirmNewPassword')}</Label>
              <Input
                type="password"
                required
                minLength={6}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={passwordLoading || !newPassword || !confirmNewPassword}>
              {passwordLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('settings.changePassword')}
            </Button>
          </form>
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
            <p className="text-xs text-muted-foreground">{t('settings.themeNote', 'Tema se primenjuje samo unutar aplikacije. Javne stranice uvek koriste svetlu temu.')}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
