import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Settings } from 'lucide-react';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { currentOrg, currentRole, refetch } = useOrganizations();
  const { toast } = useToast();

  const [orgName, setOrgName] = useState(currentOrg?.name || '');
  const [defaultCats, setDefaultCats] = useState(currentOrg?.default_categories_count ?? 6);
  const [defaultQpc, setDefaultQpc] = useState(currentOrg?.default_questions_per_category ?? 10);
  const [saving, setSaving] = useState(false);

  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const handleSave = async () => {
    if (!currentOrg || !orgName.trim()) return;
    setSaving(true);
    await supabase.from('organizations').update({
      name: orgName.trim(),
      default_categories_count: defaultCats,
      default_questions_per_category: defaultQpc,
    }).eq('id', currentOrg.id);
    await refetch();
    toast({ title: '✓', description: t('settings.saved') });
    setSaving(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-lg">
        <h1 className="font-display text-2xl font-bold">{t('settings.title')}</h1>

        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="space-y-2">
            <Label>{t('settings.orgName')}</Label>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!canEdit} />
          </div>

          <div className="space-y-2">
            <Label>{t('settings.defaultCategories')}</Label>
            <Input type="number" min={1} max={20} value={defaultCats} onChange={(e) => setDefaultCats(Number(e.target.value))} disabled={!canEdit} />
          </div>

          <div className="space-y-2">
            <Label>{t('settings.defaultQuestionsPerCategory')}</Label>
            <Input type="number" min={1} max={50} value={defaultQpc} onChange={(e) => setDefaultQpc(Number(e.target.value))} disabled={!canEdit} />
          </div>

          {canEdit && (
            <Button onClick={handleSave} disabled={saving || !orgName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
