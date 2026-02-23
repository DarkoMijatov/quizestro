import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Award, Trophy, Users, Calendar, Loader2, ArrowUpDown } from 'lucide-react';

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

export default function LeagueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg } = useOrganizations();
  const [league, setLeague] = useState<LeagueData | null>(null);
  const [rankings, setRankings] = useState<TeamRanking[]>([]);
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

      // Get finished quizzes in this league (for stats), and all quizzes for count
      const { data: quizzes } = await supabase
        .from('quizzes')
        .select('id, status')
        .eq('league_id', id)
        .eq('organization_id', currentOrg.id);

      const allQuizzes = quizzes || [];
      setQuizCount(allQuizzes.length);
      const finishedQuizIds = allQuizzes.filter(q => (q as any).status === 'finished').map(q => (q as any).id);

      if (finishedQuizIds.length === 0) { setRankings([]); setLoading(false); return; }

      // Get quiz_teams for finished quizzes
      const { data: qtData } = await supabase
        .from('quiz_teams')
        .select('team_id, quiz_id, total_points, rank')
        .in('quiz_id', finishedQuizIds);

      if (!qtData || qtData.length === 0) { setRankings([]); setLoading(false); return; }

      const teamStats: Record<string, { quizzes: number; totalPoints: number; wins: number }> = {};
      for (const qt of qtData) {
        const tid = (qt as any).team_id;
        if (!teamStats[tid]) teamStats[tid] = { quizzes: 0, totalPoints: 0, wins: 0 };
        teamStats[tid].quizzes++;
        teamStats[tid].totalPoints += Number((qt as any).total_points) || 0;
        if ((qt as any).rank === 1) teamStats[tid].wins++;
      }

      const teamIds = Object.keys(teamStats);
      const { data: teamNames } = await supabase.from('teams').select('id, name').in('id', teamIds);
      const nameMap = new Map((teamNames || []).map((t: any) => [t.id, t.name]));

      setRankings(
        Object.entries(teamStats)
          .map(([id, s]) => ({
            teamId: id,
            teamName: nameMap.get(id) || '?',
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

  const columns = [
    { key: 'teamName', label: t('scoring.team') },
    { key: 'quizzes', label: t('stats.quizzesPlayed'), align: 'right' as const },
    { key: 'totalPoints', label: t('scoring.total'), align: 'right' as const },
    { key: 'avgPoints', label: t('stats.avgPoints'), align: 'right' as const },
    { key: 'wins', label: t('stats.wins'), align: 'right' as const },
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
                        {columns.map(col => (
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
                        <tr key={row.teamId} className="border-b border-border/50 last:border-0">
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
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
