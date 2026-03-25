import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DataTable, Column, ServerParams } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Eye, Pencil, Trash2, Users, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TeamRow {
  id: string;
  name: string;
  organization_id: string;
  is_deleted: boolean;
  created_at: string;
  participations: number;
  wins: number;
  avgPoints: number | null;
}

interface TeamAlias {
  id: string;
  team_id: string;
  organization_id: string;
  alias: string;
}

const PAGE_SIZE = 15;

export default function TeamsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamAliases, setTeamAliases] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTeam, setDeleteTeam] = useState<TeamRow | null>(null);
  const [aliases, setAliases] = useState<Record<string, TeamAlias[]>>({});

  const [serverParams, setServerParams] = useState<ServerParams>({
    page: 1, pageSize: PAGE_SIZE, search: '', sortKey: 'name', sortDir: 'asc', filters: {},
  });

  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const fetchTeams = useCallback(async (params: ServerParams) => {
    if (!currentOrg) return;
    setLoading(true);

    // Count query
    let countQuery = supabase
      .from('teams')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', currentOrg.id)
      .eq('is_deleted', false);

    // Data query
    let dataQuery = supabase
      .from('teams')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .eq('is_deleted', false);

    // Search
    if (params.search) {
      const pattern = `%${params.search}%`;
      countQuery = countQuery.ilike('name', pattern);
      dataQuery = dataQuery.ilike('name', pattern);
    }

    // Sort
    const sortCol = params.sortKey || 'name';
     if (['name', 'created_at'].includes(sortCol)) {
      dataQuery = dataQuery.order(sortCol, { ascending: params.sortDir === 'asc' });
    } else {
      dataQuery = dataQuery.order('name', { ascending: true });
    }

    // Pagination
    const from = (params.page - 1) * params.pageSize;
    dataQuery = dataQuery.range(from, from + params.pageSize - 1);

    const [countRes, dataRes] = await Promise.all([countQuery, dataQuery]);
    setTotalCount(countRes.count || 0);

    const loadedTeams = (dataRes.data || []) as any[];
    if (loadedTeams.length === 0) {
      setTeams([]);
      setAliases({});
      setLoading(false);
      return;
    }

    const teamIds = loadedTeams.map((t) => t.id);

    // Fetch aliases + aggregates for current page only
    const [aliasRes, qtRes] = await Promise.all([
      supabase.from('team_aliases').select('*').in('team_id', teamIds),
      supabase.from('quiz_teams').select('team_id, total_points, rank, quiz_id').in('team_id', teamIds),
    ]);

    // Aliases
    const aliasMap: Record<string, TeamAlias[]> = {};
    ((aliasRes.data || []) as TeamAlias[]).forEach((a) => {
      if (!aliasMap[a.team_id]) aliasMap[a.team_id] = [];
      aliasMap[a.team_id].push(a);
    });
    setAliases(aliasMap);

    // Aggregates - only finished quizzes
    const qtData = (qtRes.data || []) as any[];
    const qtQuizIds = [...new Set(qtData.map((qt: any) => qt.quiz_id))];
    let finishedQuizIds = new Set<string>();
    if (qtQuizIds.length > 0) {
      const { data: quizData } = await supabase
        .from('quizzes').select('id').in('id', qtQuizIds).eq('status', 'finished');
      finishedQuizIds = new Set((quizData || []).map((q: any) => q.id));
    }

    const aggMap = new Map<string, { count: number; wins: number; totalPts: number }>();
    qtData.filter((qt: any) => finishedQuizIds.has(qt.quiz_id)).forEach((qt: any) => {
      const agg = aggMap.get(qt.team_id) || { count: 0, wins: 0, totalPts: 0 };
      agg.count++;
      agg.totalPts += Number(qt.total_points || 0);
      if (qt.rank === 1) agg.wins++;
      aggMap.set(qt.team_id, agg);
    });

    setTeams(loadedTeams.map((t) => {
      const agg = aggMap.get(t.id);
      return {
        ...t,
        participations: agg?.count || 0,
        wins: agg?.wins || 0,
        avgPoints: agg && agg.count > 0 ? Math.round((agg.totalPts / agg.count) * 10) / 10 : null,
      };
    }));
    setLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => { fetchTeams(serverParams); }, [currentOrg?.id]);

  const handleServerChange = useCallback((params: ServerParams) => {
    setServerParams(params);
    fetchTeams(params);
  }, [fetchTeams]);

  const openCreate = () => { setEditingTeam(null); setTeamName(''); setTeamAliases([]); setDialogOpen(true); };
  const openEdit = (team: TeamRow) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamAliases((aliases[team.id] || []).map((a) => a.alias));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentOrg || !teamName.trim()) return;
    setSaving(true);
    if (editingTeam) {
      await supabase.from('teams').update({ name: teamName.trim() }).eq('id', editingTeam.id);
      await supabase.from('team_aliases').delete().eq('team_id', editingTeam.id);
      const valid = teamAliases.filter((a) => a.trim());
      if (valid.length > 0) {
        await supabase.from('team_aliases').insert(valid.map((a) => ({ team_id: editingTeam.id, organization_id: currentOrg.id, alias: a.trim() })));
      }
      toast({ title: '✓', description: t('teams.updated') });
    } else {
      const { data: newTeam } = await supabase.from('teams').insert({ name: teamName.trim(), organization_id: currentOrg.id }).select().single() as { data: any };
      if (newTeam) {
        const valid = teamAliases.filter((a) => a.trim());
        if (valid.length > 0) {
          await supabase.from('team_aliases').insert(valid.map((a) => ({ team_id: newTeam.id, organization_id: currentOrg.id, alias: a.trim() })));
        }
      }
      toast({ title: '✓', description: t('teams.created') });
    }
    setSaving(false); setDialogOpen(false); fetchTeams(serverParams);
  };

  const handleDelete = async () => {
    if (!deleteTeam) return;
    await supabase.from('teams').update({ is_deleted: true }).eq('id', deleteTeam.id);
    toast({ title: '✓', description: t('teams.deleted') });
    setDeleteTeam(null); fetchTeams(serverParams);
  };

  const columns: Column<TeamRow>[] = useMemo(() => [
    {
      key: 'name', label: t('teams.teamName'), sortable: true,
      render: (r) => <p className="font-medium">{r.name}</p>,
      getValue: (r) => r.name,
    },
    {
      key: 'participations', label: t('teamsTable.participations'),
      getValue: (r) => r.participations,
    },
    {
      key: 'wins', label: t('teamsTable.wins'),
      getValue: (r) => r.wins,
    },
    {
      key: 'avgPoints', label: t('teamsTable.avgPoints'),
      render: (r) => r.avgPoints != null ? r.avgPoints : '—',
      getValue: (r) => r.avgPoints,
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/teams/${r.id}`)}>
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.view', 'Pogledaj')}</TooltipContent>
          </Tooltip>
          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.edit')}</TooltipContent>
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTeam(r)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.delete')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      ),
    },
  ], [t, canEdit, navigate, aliases]);

  return (
    <DashboardLayout>
      <DataTable
        columns={columns}
        data={teams}
        loading={loading}
        pageSize={PAGE_SIZE}
        defaultSortKey="name"
        defaultSortDir="asc"
        title={t('teams.title')}
        emptyIcon={<Users className="h-12 w-12 text-muted-foreground/30 mx-auto" />}
        emptyMessage={t('teams.noTeams')}
        emptyAction={canEdit ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('teams.addTeam')}</Button> : undefined}
        headerActions={canEdit ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('teams.addTeam')}</Button> : undefined}
        serverSide
        totalCount={totalCount}
        onServerChange={handleServerChange}
        onRowClick={(r) => navigate(`/dashboard/teams/${r.id}`)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTeam ? t('common.edit') : t('teams.addTeam')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('teams.teamName')}</Label>
              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder={t('teams.teamNamePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('teams.aliases')}</Label>
              {teamAliases.map((alias, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={alias} onChange={(e) => { const c = [...teamAliases]; c[i] = e.target.value; setTeamAliases(c); }} placeholder={t('teams.aliasPlaceholder')} />
                  <Button variant="ghost" size="icon" onClick={() => setTeamAliases(teamAliases.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setTeamAliases([...teamAliases, ''])} className="gap-1">
                <Plus className="h-3 w-3" />{t('teams.addAlias')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !teamName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTeam} onOpenChange={(o) => !o && setDeleteTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('teams.deleteConfirm')}</AlertDialogDescription>
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
