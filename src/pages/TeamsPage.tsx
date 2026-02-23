import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DataTable, Column } from '@/components/DataTable';
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

export default function TeamsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();

  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [aliases, setAliases] = useState<Record<string, TeamAlias[]>>({});
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamAliases, setTeamAliases] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteTeam, setDeleteTeam] = useState<TeamRow | null>(null);

  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const fetchTeams = async () => {
    if (!currentOrg) return;
    setLoading(true);

    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .eq('is_deleted', false)
      .order('name') as { data: any[] | null };

    const loadedTeams = teamData || [];

    // Fetch aliases
    let aliasMap: Record<string, TeamAlias[]> = {};
    if (loadedTeams.length > 0) {
      const teamIds = loadedTeams.map((t) => t.id);
      const { data: aliasData } = await supabase
        .from('team_aliases')
        .select('*')
        .in('team_id', teamIds) as { data: TeamAlias[] | null };
      (aliasData || []).forEach((a) => {
        if (!aliasMap[a.team_id]) aliasMap[a.team_id] = [];
        aliasMap[a.team_id].push(a);
      });

      // Fetch quiz_teams aggregates
      const { data: qtData } = await supabase
        .from('quiz_teams')
        .select('team_id, total_points, rank')
        .in('team_id', teamIds);

      const aggMap = new Map<string, { count: number; wins: number; totalPts: number }>();
      (qtData || []).forEach((qt: any) => {
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
    } else {
      setTeams([]);
    }
    setAliases(aliasMap);
    setLoading(false);
  };

  useEffect(() => { fetchTeams(); }, [currentOrg?.id]);

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
    setSaving(false); setDialogOpen(false); fetchTeams();
  };

  const handleDelete = async () => {
    if (!deleteTeam) return;
    await supabase.from('teams').update({ is_deleted: true }).eq('id', deleteTeam.id);
    toast({ title: '✓', description: t('teams.deleted') });
    setDeleteTeam(null); fetchTeams();
  };

  const columns: Column<TeamRow>[] = useMemo(() => [
    {
      key: 'name', label: t('teams.teamName'), sortable: true,
      render: (r) => <p className="font-medium">{r.name}</p>,
      getValue: (r) => r.name,
    },
    {
      key: 'participations', label: t('teamsTable.participations'), sortable: true,
      getValue: (r) => r.participations,
    },
    {
      key: 'wins', label: t('teamsTable.wins'), sortable: true,
      getValue: (r) => r.wins,
    },
    {
      key: 'avgPoints', label: t('teamsTable.avgPoints'), sortable: true,
      render: (r) => r.avgPoints != null ? r.avgPoints : '—',
      getValue: (r) => r.avgPoints,
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/teams/${r.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={() => setDeleteTeam(r)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
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
        pageSize={10}
        defaultSortKey="name"
        defaultSortDir="asc"
        title={t('teams.title')}
        emptyIcon={<Users className="h-12 w-12 text-muted-foreground/30 mx-auto" />}
        emptyMessage={t('teams.noTeams')}
        emptyAction={canEdit ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('teams.addTeam')}</Button> : undefined}
        headerActions={canEdit ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('teams.addTeam')}</Button> : undefined}
        searchFn={(row, q) => {
          if (row.name.toLowerCase().includes(q)) return true;
          return (aliases[row.id] || []).some((a) => a.alias.toLowerCase().includes(q));
        }}
        onRowClick={(r) => navigate(`/dashboard/teams/${r.id}`)}
      />

      {/* Create/Edit Dialog */}
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
