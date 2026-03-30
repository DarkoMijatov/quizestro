import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DataTable, Column, FilterConfig, ServerParams } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { srLatn } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Award, Loader2 } from 'lucide-react';

interface League {
  id: string;
  name: string;
  season: string | null;
  is_active: boolean;
  organization_id: string;
}

interface LeagueRow extends League {
  quizCount: number;
  leaderName: string | null;
  firstDate: string | null;
  lastDate: string | null;
}

const PAGE_SIZE = 15;

export default function LeaguesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();

  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<League | null>(null);
  const [leagueName, setLeagueName] = useState('');
  const [season, setSeason] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<League | null>(null);

  const [serverParams, setServerParams] = useState<ServerParams>({
    page: 1, pageSize: PAGE_SIZE, search: '', sortKey: 'lastDate', sortDir: 'desc', filters: {},
  });

  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const fetchLeagues = useCallback(async (params: ServerParams) => {
    if (!currentOrg) return;
    setLoading(true);

    let countQuery = supabase
      .from('leagues')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', currentOrg.id);

    let dataQuery = supabase
      .from('leagues')
      .select('*')
      .eq('organization_id', currentOrg.id);

    // Status filter
    const statusFilter = params.filters.status;
    if (statusFilter && statusFilter !== 'all') {
      const isActiveVal = statusFilter === 'active';
      countQuery = countQuery.eq('is_active', isActiveVal);
      dataQuery = dataQuery.eq('is_active', isActiveVal);
    }

    // Search
    if (params.search) {
      const pattern = `%${params.search}%`;
      countQuery = countQuery.or(`name.ilike.${pattern},season.ilike.${pattern}`);
      dataQuery = dataQuery.or(`name.ilike.${pattern},season.ilike.${pattern}`);
    }

    const [countRes, dataRes] = await Promise.all([countQuery, dataQuery]);
    setTotalCount(countRes.count || 0);

    const rawLeagues = (dataRes.data || []) as League[];
    if (rawLeagues.length === 0) { setLeagues([]); setLoading(false); return; }

    const leagueIds = rawLeagues.map(l => l.id);

    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('id, league_id, status, date')
      .in('league_id', leagueIds);

    const quizCountMap: Record<string, number> = {};
    const finishedQuizIdsByLeague: Record<string, string[]> = {};
    const datesByLeague: Record<string, string[]> = {};
    for (const q of (quizzes || [])) {
      const lid = (q as any).league_id;
      quizCountMap[lid] = (quizCountMap[lid] || 0) + 1;
      if (!datesByLeague[lid]) datesByLeague[lid] = [];
      datesByLeague[lid].push((q as any).date);
      if ((q as any).status === 'finished') {
        if (!finishedQuizIdsByLeague[lid]) finishedQuizIdsByLeague[lid] = [];
        finishedQuizIdsByLeague[lid].push((q as any).id);
      }
    }

    const allFinishedIds = Object.values(finishedQuizIdsByLeague).flat();
    let leaderMap: Record<string, string> = {};
    if (allFinishedIds.length > 0) {
      const { data: qtData } = await supabase
        .from('quiz_teams').select('team_id, quiz_id, total_points').in('quiz_id', allFinishedIds);

      const teamPointsByLeague: Record<string, Record<string, number>> = {};
      for (const qt of (qtData || [])) {
        for (const [lid, qids] of Object.entries(finishedQuizIdsByLeague)) {
          if (qids.includes((qt as any).quiz_id)) {
            if (!teamPointsByLeague[lid]) teamPointsByLeague[lid] = {};
            const tid = (qt as any).team_id;
            teamPointsByLeague[lid][tid] = (teamPointsByLeague[lid][tid] || 0) + (Number((qt as any).total_points) || 0);
            break;
          }
        }
      }

      const allTeamIds = new Set<string>();
      const leaderTeamIds: Record<string, string> = {};
      for (const [lid, teams] of Object.entries(teamPointsByLeague)) {
        let maxPts = -1; let maxTid = '';
        for (const [tid, pts] of Object.entries(teams)) {
          if (pts > maxPts) { maxPts = pts; maxTid = tid; }
        }
        if (maxTid) { leaderTeamIds[lid] = maxTid; allTeamIds.add(maxTid); }
      }

      if (allTeamIds.size > 0) {
        const { data: teamNames } = await supabase.from('teams').select('id, name').in('id', Array.from(allTeamIds));
        const nameMap = new Map((teamNames || []).map((t: any) => [t.id, t.name]));
        for (const [lid, tid] of Object.entries(leaderTeamIds)) {
          leaderMap[lid] = nameMap.get(tid) || '?';
        }
      }
    }

    const sortedLeagues = rawLeagues.map(l => {
      const dates = (datesByLeague[l.id] || []).sort();
      return {
        ...l,
        quizCount: quizCountMap[l.id] || 0,
        leaderName: leaderMap[l.id] || null,
        firstDate: dates.length > 0 ? dates[0] : null,
        lastDate: dates.length > 0 ? dates[dates.length - 1] : null,
      };
    }).sort((a, b) => {
      const sortKey = params.sortKey || 'lastDate';
      const sortDir = params.sortDir === 'asc' ? 1 : -1;
      const getSortableValue = (row: LeagueRow) => {
        switch (sortKey) {
          case 'firstDate':
            return row.firstDate || '';
          case 'lastDate':
            return row.lastDate || '';
          case 'quizCount':
            return row.quizCount;
          case 'leaderName':
            return row.leaderName || '';
          case 'is_active':
            return row.is_active ? 1 : 0;
          case 'season':
            return row.season || '';
          case 'name':
          default:
            return row.name;
        }
      };

      const aValue = getSortableValue(a);
      const bValue = getSortableValue(b);
      const comparison = typeof aValue === 'number' && typeof bValue === 'number'
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), i18n.language);

      return comparison * sortDir;
    });

    const from = (params.page - 1) * params.pageSize;
    setLeagues(sortedLeagues.slice(from, from + params.pageSize));
    setLoading(false);
  }, [currentOrg?.id, i18n.language]);

  useEffect(() => { fetchLeagues(serverParams); }, [fetchLeagues]);

  const handleServerChange = useCallback((params: ServerParams) => {
    setServerParams(params);
    fetchLeagues(params);
  }, [fetchLeagues]);

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
    setSaving(false); setDialogOpen(false); fetchLeagues(serverParams);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await supabase.from('leagues').delete().eq('id', deleteItem.id);
    toast({ title: '✓', description: t('leagues.deleted') });
    setDeleteItem(null); fetchLeagues(serverParams);
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return i18n.language === 'sr'
      ? format(new Date(d), 'dd. MMMM yyyy.', { locale: srLatn })
      : format(new Date(d), 'MMM dd, yyyy');
  };

  const columns: Column<LeagueRow>[] = [
    { key: 'name', label: t('leagues.leagueName'), sortable: true, render: (r) => (
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4 text-primary shrink-0" />
        <span className="font-medium">{r.name}</span>
        {r.season && <span className="text-xs text-muted-foreground">({r.season})</span>}
      </div>
    )},
    { key: 'firstDate', label: t('leagues.startDate', 'Početak'), sortable: true, render: (r) => (
      <span className="text-sm text-muted-foreground">{formatDate(r.firstDate)}</span>
    ), getValue: (r) => r.firstDate || '' },
    { key: 'lastDate', label: t('leagues.endDate', 'Kraj'), sortable: true, render: (r) => (
      <span className="text-sm text-muted-foreground">{formatDate(r.lastDate)}</span>
    ), getValue: (r) => r.lastDate || '' },
    { key: 'is_active', label: t('filters.status'), sortable: true, render: (r) => (
      <Badge variant={r.is_active ? 'default' : 'secondary'} className="text-xs">
        {r.is_active ? t('leagues.active') : t('leagues.inactive')}
      </Badge>
    ), getValue: (r) => r.is_active ? 1 : 0 },
    { key: 'quizCount', label: t('leagueDetail.quizCount'), sortable: true, getValue: (r) => r.quizCount },
    { key: 'leaderName', label: t('leagueDetail.leaderOrWinner'), sortable: true, render: (r) => (
      <span className="text-sm">{r.leaderName || '-'}</span>
    ), getValue: (r) => r.leaderName || '' },
    ...(canEdit ? [{
      key: 'actions' as string,
      label: '',
      render: (r: LeagueRow) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDeleteItem(r); }}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    }] : []),
  ];

  const filterConfigs: FilterConfig[] = [
    { key: 'status', label: t('filters.status'), options: [
      { value: 'active', label: t('leagues.active') },
      { value: 'inactive', label: t('leagues.inactive') },
    ]},
  ];

  return (
    <DashboardLayout>
      <DataTable
        title={t('leagues.title')}
        columns={columns}
        data={leagues}
        loading={loading}
        pageSize={PAGE_SIZE}
        defaultSortKey="lastDate"
        defaultSortDir="desc"
        filters={filterConfigs}
        emptyIcon={<Award className="h-12 w-12 text-muted-foreground/30 mx-auto" />}
        emptyMessage={t('leagues.noLeagues')}
        emptyAction={canEdit ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('leagues.addLeague')}</Button> : undefined}
        onRowClick={(r) => navigate(`/dashboard/leagues/${r.id}`)}
        headerActions={canEdit ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('leagues.addLeague')}</Button> : undefined}
        serverSide
        totalCount={totalCount}
        onServerChange={handleServerChange}
      />

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
