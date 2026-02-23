import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DataTable, Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Award, Trophy, Users, Loader2, ArrowUpDown, Calendar, MapPin } from 'lucide-react';

interface LeagueData {
  id: string;
  name: string;
  season: string | null;
  is_active: boolean;
  created_at: string;
}

interface TeamRanking {
  teamId: string;
  teamName: string;
  quizzes: number;
  totalPoints: number;
  avgPoints: number;
  wins: number;
}

interface QuizRow {
  id: string;
  name: string;
  date: string;
  status: string;
  location: string | null;
  teamCount: number;
  winnerName: string | null;
}

export default function LeagueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg } = useOrganizations();
  const [league, setLeague] = useState<LeagueData | null>(null);
  const [rankings, setRankings] = useState<TeamRanking[]>([]);
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [quizCount, setQuizCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState('totalPoints');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!currentOrg || !id) return;
    const load = async () => {
      setLoading(true);

      const { data: leagueData } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', id)
        .single();

      if (!leagueData) { setLoading(false); return; }
      setLeague(leagueData as LeagueData);

      const { data: quizData } = await supabase
        .from('quizzes')
        .select('id, name, date, status, location')
        .eq('league_id', id)
        .eq('organization_id', currentOrg.id)
        .order('date', { ascending: false });

      const allQuizzes = quizData || [];
      setQuizCount(allQuizzes.length);
      const quizIds = allQuizzes.map(q => (q as any).id);
      const finishedQuizIds = allQuizzes.filter(q => (q as any).status === 'finished').map(q => (q as any).id);

      // Get quiz_teams for all quizzes to count teams and find winners
      let qtData: any[] = [];
      if (quizIds.length > 0) {
        const { data } = await supabase
          .from('quiz_teams')
          .select('team_id, quiz_id, total_points, rank')
          .in('quiz_id', quizIds);
        qtData = data || [];
      }

      // Build quiz rows with team counts and winners
      const teamCountByQuiz: Record<string, number> = {};
      const winnerByQuiz: Record<string, string> = {};
      const allTeamIds = new Set<string>();
      for (const qt of qtData) {
        teamCountByQuiz[qt.quiz_id] = (teamCountByQuiz[qt.quiz_id] || 0) + 1;
        if (qt.rank === 1) {
          winnerByQuiz[qt.quiz_id] = qt.team_id;
          allTeamIds.add(qt.team_id);
        }
      }

      // Get team names
      let teamNameMap = new Map<string, string>();
      // Also need all team ids for rankings
      for (const qt of qtData) allTeamIds.add(qt.team_id);
      if (allTeamIds.size > 0) {
        const { data: teamNames } = await supabase.from('teams').select('id, name').in('id', Array.from(allTeamIds));
        teamNameMap = new Map((teamNames || []).map((t: any) => [t.id, t.name]));
      }

      setQuizzes(allQuizzes.map((q: any) => ({
        id: q.id,
        name: q.name,
        date: q.date,
        status: q.status,
        location: q.location,
        teamCount: teamCountByQuiz[q.id] || 0,
        winnerName: winnerByQuiz[q.id] ? teamNameMap.get(winnerByQuiz[q.id]) || '?' : null,
      })));

      // Build rankings from finished quizzes only
      if (finishedQuizIds.length === 0) { setRankings([]); setLoading(false); return; }

      const teamStats: Record<string, { quizzes: number; totalPoints: number; wins: number }> = {};
      for (const qt of qtData) {
        if (!finishedQuizIds.includes(qt.quiz_id)) continue;
        const tid = qt.team_id;
        if (!teamStats[tid]) teamStats[tid] = { quizzes: 0, totalPoints: 0, wins: 0 };
        teamStats[tid].quizzes++;
        teamStats[tid].totalPoints += Number(qt.total_points) || 0;
        if (qt.rank === 1) teamStats[tid].wins++;
      }

      setRankings(
        Object.entries(teamStats)
          .map(([tid, s]) => ({
            teamId: tid,
            teamName: teamNameMap.get(tid) || '?',
            quizzes: s.quizzes,
            totalPoints: Math.round(s.totalPoints * 10) / 10,
            avgPoints: s.quizzes > 0 ? Math.round((s.totalPoints / s.quizzes) * 10) / 10 : 0,
            wins: s.wins,
          }))
          .sort((a, b) => b.totalPoints - a.totalPoints)
      );

      setLoading(false);
    };
    load();
  }, [currentOrg?.id, id]);

  const sorted = useMemo(() => {
    return [...rankings].sort((a, b) => {
      const va = (a as any)[sortKey];
      const vb = (b as any)[sortKey];
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rankings, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const leader = rankings.length > 0 ? rankings[0] : null;

  const statCards = [
    { label: t('leagueDetail.quizCount'), value: quizCount, icon: Trophy },
    { label: league?.is_active ? t('leagueDetail.leadingTeam') : t('leagueDetail.winnerTeam'), value: leader?.teamName || '-', icon: Users },
    { label: t('leagueDetail.totalTeams'), value: rankings.length, icon: Users },
  ];

  const standingsColumns = [
    { key: 'teamName', label: t('scoring.team') },
    { key: 'quizzes', label: t('stats.quizzesPlayed'), align: 'right' as const },
    { key: 'totalPoints', label: t('scoring.total'), align: 'right' as const },
    { key: 'avgPoints', label: t('stats.avgPoints'), align: 'right' as const },
    { key: 'wins', label: t('stats.wins'), align: 'right' as const },
  ];

  const quizColumns: Column<QuizRow>[] = [
    { key: 'name', label: t('quiz.name'), sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'date', label: t('quiz.date'), sortable: true, render: (r) => (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        {new Date(r.date).toLocaleDateString()}
      </div>
    )},
    { key: 'status', label: t('filters.status'), sortable: true, render: (r) => {
      const v = r.status === 'finished' ? 'default' : r.status === 'live' ? 'destructive' : 'secondary';
      return <Badge variant={v as any} className="text-xs">{t(`filters.${r.status}`)}</Badge>;
    }},
    { key: 'teamCount', label: t('quizzes.teamCount'), sortable: true, getValue: (r) => r.teamCount },
    { key: 'winnerName', label: t('quizzes.winner'), sortable: true, render: (r) => (
      <span className="text-sm">{r.winnerName || '-'}</span>
    ), getValue: (r) => r.winnerName || '' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/leagues')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {league && (
            <div className="flex items-center gap-3">
              <Award className="h-6 w-6 text-primary" />
              <div>
                <h1 className="font-display text-2xl font-bold">{league.name}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  {league.season && <span className="text-sm text-muted-foreground">{league.season}</span>}
                  <Badge variant={league.is_active ? 'default' : 'secondary'}>
                    {league.is_active ? t('leagues.active') : t('leagues.inactive')}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !league ? (
          <p className="text-muted-foreground">{t('common.noResults')}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {statCards.map((c) => (
                <div key={c.label} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{c.label}</span>
                    <c.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="mt-2 text-2xl font-bold font-display truncate">{c.value}</p>
                </div>
              ))}
            </div>

            {/* Standings */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-display font-semibold mb-4">{t('leagueDetail.standings')}</h3>
              {rankings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t('stats.noData')}</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground w-10">#</th>
                        {standingsColumns.map(col => (
                          <th key={col.key} className={`py-2 px-3 font-medium text-muted-foreground ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                            <Button variant="ghost" size="sm" className="h-auto p-0 font-medium hover:text-foreground gap-1" onClick={() => toggleSort(col.key)}>
                              {col.label}
                              <ArrowUpDown className="h-3 w-3" />
                            </Button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((row, i) => (
                        <tr key={row.teamId} className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/teams/${row.teamId}`)}>
                          <td className="py-2.5 px-3 font-bold text-muted-foreground">{i + 1}</td>
                          <td className="py-2.5 px-3 font-medium">{row.teamName}</td>
                          <td className="py-2.5 px-3 text-right">{row.quizzes}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-primary">{row.totalPoints}</td>
                          <td className="py-2.5 px-3 text-right">{row.avgPoints}</td>
                          <td className="py-2.5 px-3 text-right">{row.wins}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quiz list */}
            <DataTable
              title={t('leagueDetail.quizList')}
              columns={quizColumns}
              data={quizzes}
              defaultSortKey="date"
              defaultSortDir="desc"
              searchFn={(r, q) => r.name.toLowerCase().includes(q)}
              emptyIcon={<Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto" />}
              emptyMessage={t('leagueDetail.noQuizzes')}
              onRowClick={(r) => navigate(`/dashboard/quizzes/${r.id}`)}
              pageSize={10}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
