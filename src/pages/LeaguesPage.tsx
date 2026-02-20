import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Award, Loader2, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface League {
  id: string;
  name: string;
  season: string | null;
  is_active: boolean;
  organization_id: string;
}

export default function LeaguesPage() {
  const { t } = useTranslation();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<League | null>(null);
  const [leagueName, setLeagueName] = useState('');
  const [season, setSeason] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<League | null>(null);

  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const fetchLeagues = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from('leagues')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .order('created_at', { ascending: false }) as { data: League[] | null };
    setLeagues(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLeagues(); }, [currentOrg?.id]);

  const openCreate = () => {
    setEditing(null); setLeagueName(''); setSeason(''); setIsActive(true); setDialogOpen(true);
  };

  const openEdit = (l: League) => {
    setEditing(l); setLeagueName(l.name); setSeason(l.season || ''); setIsActive(l.is_active); setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentOrg || !leagueName.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('leagues').update({ name: leagueName.trim(), season: season.trim() || null, is_active: isActive }).eq('id', editing.id);
      toast({ title: '✓', description: t('leagues.updated') });
    } else {
      await supabase.from('leagues').insert({ name: leagueName.trim(), season: season.trim() || null, is_active: isActive, organization_id: currentOrg.id });
      toast({ title: '✓', description: t('leagues.created') });
    }
    setSaving(false); setDialogOpen(false); fetchLeagues();
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await supabase.from('leagues').delete().eq('id', deleteItem.id);
    toast({ title: '✓', description: t('leagues.deleted') });
    setDeleteItem(null); fetchLeagues();
  };

  const filtered = leagues.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">{t('leagues.title')}</h1>
          {canEdit && (
            <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('leagues.addLeague')}</Button>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Award className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{search ? t('common.noResults') : t('leagues.noLeagues')}</p>
            {!search && canEdit && (
              <Button onClick={openCreate} className="mt-4 gap-2"><Plus className="h-4 w-4" />{t('leagues.addLeague')}</Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((league) => (
              <div key={league.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Award className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium">{league.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {league.season && <span className="text-xs text-muted-foreground">{league.season}</span>}
                      <Badge variant={league.is_active ? 'default' : 'secondary'} className="text-xs">
                        {league.is_active ? t('leagues.active') : t('leagues.inactive')}
                      </Badge>
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0 ml-4">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(league)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteItem(league)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t('common.edit') : t('leagues.addLeague')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('leagues.leagueName')}</Label>
              <Input value={leagueName} onChange={(e) => setLeagueName(e.target.value)} placeholder={t('leagues.leagueNamePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('leagues.season')}</Label>
              <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder={t('leagues.seasonPlaceholder')} />
            </div>
            <div className="flex items-center justify-between">
              <Label>{t('leagues.active')}</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !leagueName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('leagues.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
