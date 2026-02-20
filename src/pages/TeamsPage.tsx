import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
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
import { Plus, Pencil, Trash2, Users, Tag, Loader2, Search } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  organization_id: string;
  is_deleted: boolean;
  created_at: string;
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

  const [teams, setTeams] = useState<Team[]>([]);
  const [aliases, setAliases] = useState<Record<string, TeamAlias[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamAliases, setTeamAliases] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null);

  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const fetchTeams = async () => {
    if (!currentOrg) return;
    setLoading(true);

    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .eq('is_deleted', false)
      .order('name') as { data: Team[] | null };

    const loadedTeams = teamData || [];
    setTeams(loadedTeams);

    // Fetch aliases for all teams
    if (loadedTeams.length > 0) {
      const { data: aliasData } = await supabase
        .from('team_aliases')
        .select('*')
        .in('team_id', loadedTeams.map((t) => t.id)) as { data: TeamAlias[] | null };

      const grouped: Record<string, TeamAlias[]> = {};
      (aliasData || []).forEach((a) => {
        if (!grouped[a.team_id]) grouped[a.team_id] = [];
        grouped[a.team_id].push(a);
      });
      setAliases(grouped);
    } else {
      setAliases({});
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchTeams();
  }, [currentOrg?.id]);

  const openCreate = () => {
    setEditingTeam(null);
    setTeamName('');
    setTeamAliases([]);
    setDialogOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamAliases((aliases[team.id] || []).map((a) => a.alias));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!currentOrg || !teamName.trim()) return;
    setSaving(true);

    if (editingTeam) {
      // Update team name
      await supabase.from('teams').update({ name: teamName.trim() }).eq('id', editingTeam.id);

      // Delete old aliases, insert new
      await supabase.from('team_aliases').delete().eq('team_id', editingTeam.id);
      const validAliases = teamAliases.filter((a) => a.trim());
      if (validAliases.length > 0) {
        await supabase.from('team_aliases').insert(
          validAliases.map((a) => ({ team_id: editingTeam.id, organization_id: currentOrg.id, alias: a.trim() }))
        );
      }
      toast({ title: '✓', description: t('teams.updated') });
    } else {
      // Create team
      const { data: newTeam } = await supabase
        .from('teams')
        .insert({ name: teamName.trim(), organization_id: currentOrg.id })
        .select()
        .single() as { data: Team | null };

      if (newTeam) {
        const validAliases = teamAliases.filter((a) => a.trim());
        if (validAliases.length > 0) {
          await supabase.from('team_aliases').insert(
            validAliases.map((a) => ({ team_id: newTeam.id, organization_id: currentOrg.id, alias: a.trim() }))
          );
        }
      }
      toast({ title: '✓', description: t('teams.created') });
    }

    setSaving(false);
    setDialogOpen(false);
    fetchTeams();
  };

  const handleDelete = async () => {
    if (!deleteTeam) return;
    // Soft delete
    await supabase.from('teams').update({ is_deleted: true }).eq('id', deleteTeam.id);
    toast({ title: '✓', description: t('teams.deleted') });
    setDeleteTeam(null);
    fetchTeams();
  };

  const filteredTeams = teams.filter((t) => {
    const q = search.toLowerCase();
    if (t.name.toLowerCase().includes(q)) return true;
    return (aliases[t.id] || []).some((a) => a.alias.toLowerCase().includes(q));
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">{t('teams.title')}</h1>
          {canEdit && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('teams.addTeam')}
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Team list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{search ? t('common.noResults') : t('teams.noTeams')}</p>
            {!search && canEdit && (
              <Button onClick={openCreate} className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                {t('teams.addTeam')}
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredTeams.map((team) => (
              <div key={team.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => navigate(`/dashboard/teams/${team.id}`)}>
                <div className="min-w-0">
                  <p className="font-medium truncate">{team.name}</p>
                  {(aliases[team.id] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {(aliases[team.id] || []).map((a) => (
                        <span key={a.id} className="inline-flex items-center gap-1 text-xs rounded-full bg-accent px-2 py-0.5 text-accent-foreground">
                          <Tag className="h-3 w-3" />
                          {a.alias}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 ml-4 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(team)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteTeam(team)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTeam ? t('common.edit') : t('teams.addTeam')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('teams.teamName')}</Label>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder={t('teams.teamNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('teams.aliases')}</Label>
              {teamAliases.map((alias, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={alias}
                    onChange={(e) => {
                      const copy = [...teamAliases];
                      copy[i] = e.target.value;
                      setTeamAliases(copy);
                    }}
                    placeholder={t('teams.aliasPlaceholder')}
                  />
                  <Button variant="ghost" size="icon" onClick={() => setTeamAliases(teamAliases.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setTeamAliases([...teamAliases, ''])} className="gap-1">
                <Plus className="h-3 w-3" />
                {t('teams.addAlias')}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !teamName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
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
