import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Loader2, Trophy, Users, FolderOpen, Award, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopTeam { name: string; quizzes: number; wins: number; avgPoints: number }
interface BestCategory { name: string; avgPoints: number }
interface BestQuiz { name: string; date: string; teamCount: number; avgPoints: number }
interface TopLeague { name: string; season: string; quizCount: number; leaderName: string; is_active: boolean }

type SortDir = 'asc' | 'desc';

function SortableTable<T>({ data, columns, defaultSortKey, defaultSortDir = 'desc', maxVisible = 10 }: {
  data: T[];
  columns: { key: string; label: string; getValue: (row: T) => string | number; align?: 'left' | 'right'; render?: (row: T) => React.ReactNode }[];
  defaultSortKey: string;
  defaultSortDir?: SortDir;
  maxVisible?: number;
}) {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);

  const sorted = useMemo(() => {
    const col = columns.find(c => c.key === sortKey);
    if (!col) return data;
    return [...data].sort((a, b) => {
      const va = col.getValue(a);
      const vb = col.getValue(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  if (data.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">{t('stats.noData')}</p>;

  const visible = sorted.slice(0, maxVisible);
  const hasMore = sorted.length > maxVisible;

  return (
    <div className={hasMore ? "max-h-[400px] overflow-auto" : "overflow-auto"}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card z-10">
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
          {(hasMore ? sorted : visible).map((row, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="py-2.5 px-3 font-bold text-muted-foreground">{i + 1}</td>
              {columns.map(col => (
                <td key={col.key} className={`py-2.5 px-3 ${col.align === 'right' ? 'text-right' : ''} ${col.key === 'name' ? 'font-medium' : ''} ${col.key === 'avgPoints' || col.key === 'totalPoints' ? 'font-semibold text-primary' : ''}`}>
                  {col.render ? col.render(row) : col.getValue(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StatsPage() {
  const { t } = useTranslation();
  const { currentOrg } = useOrganizations();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ quizzes: 0, teams: 0, categories: 0, leagues: 0 });
  const [topTeams, setTopTeams] = useState<TopTeam[]>([]);
  const [bestCategories, setBestCategories] = useState<BestCategory[]>([]);
  const [bestQuizzes, setBestQuizzes] = useState<BestQuiz[]>([]);
  const [topLeagues, setTopLeagues] = useState<TopLeague[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    const load = async () => {
      setLoading(true);

      const [q, tm, c, l] = await Promise.all([
        supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
        supabase.from('teams').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).eq('is_deleted', false),
        supabase.from('categories').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).eq('is_deleted', false),
        supabase.from('leagues').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
      ]);
      setCounts({ quizzes: q.count || 0, teams: tm.count || 0, categories: c.count || 0, leagues: l.count || 0 });

      // Get all quizzes to know which are finished
      const { data: allQuizzes } = await supabase
        .from('quizzes')
        .select('id, name, date, status, league_id')
        .eq('organization_id', currentOrg.id);

      const finishedQuizIds = new Set((allQuizzes || []).filter((q: any) => q.status === 'finished').map((q: any) => q.id));

      // Get quiz_teams only for finished quizzes
      const { data: allQtData } = await supabase
        .from('quiz_teams')
        .select('team_id, quiz_id, total_points, rank')
        .eq('organization_id', currentOrg.id);

      const qtFinished = (allQtData || []).filter((qt: any) => finishedQuizIds.has(qt.quiz_id));

      // Top teams (only finished quizzes)
      if (qtFinished.length > 0) {
        const teamStats: Record<string, { quizzes: number; wins: number; totalPoints: number }> = {};
        for (const qt of qtFinished) {
          const tid = (qt as any).team_id;
          if (!teamStats[tid]) teamStats[tid] = { quizzes: 0, wins: 0, totalPoints: 0 };
          teamStats[tid].quizzes++;
          teamStats[tid].totalPoints += Number((qt as any).total_points) || 0;
          if ((qt as any).rank === 1) teamStats[tid].wins++;
        }

        const teamIds = Object.keys(teamStats);
        const { data: teamNames } = await supabase.from('teams').select('id, name').in('id', teamIds);
        const nameMap = new Map((teamNames || []).map((t: any) => [t.id, t.name]));
        setTopTeams(
          Object.entries(teamStats)
            .map(([id, s]) => ({
              name: nameMap.get(id) || '?',
              quizzes: s.quizzes,
              wins: s.wins,
              avgPoints: s.quizzes > 0 ? Math.round((s.totalPoints / s.quizzes) * 10) / 10 : 0,
            }))
            .sort((a, b) => b.quizzes - a.quizzes)
        );
      }

      // Best categories (only finished quizzes)
      const { data: scoresData } = await supabase
        .from('scores')
        .select('quiz_category_id, quiz_id, points, bonus_points')
        .eq('organization_id', currentOrg.id);

      const finishedScores = (scoresData || []).filter((s: any) => finishedQuizIds.has(s.quiz_id));

      if (finishedScores.length > 0) {
        const { data: qcData } = await supabase
          .from('quiz_categories')
          .select('id, category_id')
          .eq('organization_id', currentOrg.id);

        const qcMap = new Map((qcData || []).map((qc: any) => [qc.id, qc.category_id]));

        const catStats: Record<string, { total: number; count: number }> = {};
        for (const s of finishedScores) {
          const catId = qcMap.get((s as any).quiz_category_id);
          if (!catId) continue;
          if (!catStats[catId]) catStats[catId] = { total: 0, count: 0 };
          catStats[catId].total += Number((s as any).points) + Number((s as any).bonus_points);
          catStats[catId].count++;
        }

        const catIds = Object.keys(catStats);
        if (catIds.length > 0) {
          const { data: catNames } = await supabase.from('categories').select('id, name').in('id', catIds);
          const cNameMap = new Map((catNames || []).map((c: any) => [c.id, c.name]));
          setBestCategories(
            Object.entries(catStats)
              .map(([id, s]) => ({
                name: cNameMap.get(id) || '?',
                avgPoints: s.count > 0 ? Math.round((s.total / s.count) * 10) / 10 : 0,
              }))
              .sort((a, b) => b.avgPoints - a.avgPoints)
          );
        }
      }

      // Best quizzes (only finished)
      if (qtFinished.length > 0) {
        const quizStats: Record<string, { totalPoints: number; teamCount: number }> = {};
        for (const qt of qtFinished) {
          const qid = (qt as any).quiz_id;
          if (!quizStats[qid]) quizStats[qid] = { totalPoints: 0, teamCount: 0 };
          quizStats[qid].totalPoints += Number((qt as any).total_points) || 0;
          quizStats[qid].teamCount++;
        }

        const quizMap = new Map((allQuizzes || []).map((q: any) => [q.id, q]));
        setBestQuizzes(
          Object.entries(quizStats)
            .map(([id, s]) => {
              const quiz = quizMap.get(id);
              return {
                name: quiz?.name || '?',
                date: quiz?.date || '',
                teamCount: s.teamCount,
                avgPoints: s.teamCount > 0 ? Math.round((s.totalPoints / s.teamCount) * 10) / 10 : 0,
              };
            })
            .sort((a, b) => b.avgPoints - a.avgPoints)
        );
      }

      // Top leagues
      const { data: leaguesData } = await supabase
        .from('leagues')
        .select('id, name, season, is_active')
        .eq('organization_id', currentOrg.id);

      if (leaguesData && leaguesData.length > 0) {
        const leagueQuizMap: Record<string, { count: number; finishedIds: string[] }> = {};
        for (const quiz of (allQuizzes || [])) {
          const lid = (quiz as any).league_id;
          if (!lid) continue;
          if (!leagueQuizMap[lid]) leagueQuizMap[lid] = { count: 0, finishedIds: [] };
          leagueQuizMap[lid].count++;
          if ((quiz as any).status === 'finished') leagueQuizMap[lid].finishedIds.push((quiz as any).id);
        }

        // Find leader per league from finished quizzes
        const leagueLeaders: Record<string, string> = {};
        for (const [lid, info] of Object.entries(leagueQuizMap)) {
          if (info.finishedIds.length === 0) continue;
          const teamPts: Record<string, number> = {};
          for (const qt of qtFinished) {
            if (info.finishedIds.includes((qt as any).quiz_id)) {
              const tid = (qt as any).team_id;
              teamPts[tid] = (teamPts[tid] || 0) + (Number((qt as any).total_points) || 0);
            }
          }
          let maxTid = ''; let maxPts = -1;
          for (const [tid, pts] of Object.entries(teamPts)) {
            if (pts > maxPts) { maxPts = pts; maxTid = tid; }
          }
          if (maxTid) leagueLeaders[lid] = maxTid;
        }

        const allLeaderTids = new Set(Object.values(leagueLeaders));
        let leaderNameMap = new Map<string, string>();
        if (allLeaderTids.size > 0) {
          const { data: tn } = await supabase.from('teams').select('id, name').in('id', Array.from(allLeaderTids));
          leaderNameMap = new Map((tn || []).map((t: any) => [t.id, t.name]));
        }

        setTopLeagues(
          (leaguesData as any[]).map(l => ({
            name: l.name,
            season: l.season || '',
            is_active: l.is_active,
            quizCount: leagueQuizMap[l.id]?.count || 0,
            leaderName: leagueLeaders[l.id] ? (leaderNameMap.get(leagueLeaders[l.id]) || '?') : '-',
          }))
          .sort((a, b) => b.quizCount - a.quizCount)
        );
      }

      setLoading(false);
    };
    load();
  }, [currentOrg?.id]);

  const cards = [
    { label: t('dashboard.quizzes'), value: counts.quizzes, icon: Trophy, color: 'text-primary' },
    { label: t('dashboard.teams'), value: counts.teams, icon: Users, color: 'text-blue-500' },
    { label: t('dashboard.categories'), value: counts.categories, icon: FolderOpen, color: 'text-emerald-500' },
    { label: t('dashboard.leagues'), value: counts.leagues, icon: Award, color: 'text-purple-500' },
  ];

  const teamColumns = [
    { key: 'name', label: t('scoring.team'), getValue: (r: TopTeam) => r.name },
    { key: 'quizzes', label: t('stats.quizzesPlayed'), getValue: (r: TopTeam) => r.quizzes, align: 'right' as const },
    { key: 'wins', label: t('stats.wins'), getValue: (r: TopTeam) => r.wins, align: 'right' as const },
    { key: 'avgPoints', label: t('stats.avgPoints'), getValue: (r: TopTeam) => r.avgPoints, align: 'right' as const },
  ];

  const catColumns = [
    { key: 'name', label: t('categories.categoryName'), getValue: (r: BestCategory) => r.name },
    { key: 'avgPoints', label: t('stats.avgPoints'), getValue: (r: BestCategory) => r.avgPoints, align: 'right' as const },
  ];

  const quizColumns = [
    { key: 'name', label: t('quiz.name'), getValue: (r: BestQuiz) => r.name },
    { key: 'teamCount', label: t('quizzes.teamCount'), getValue: (r: BestQuiz) => r.teamCount, align: 'right' as const },
    { key: 'avgPoints', label: t('stats.avgPoints'), getValue: (r: BestQuiz) => r.avgPoints, align: 'right' as const },
  ];

  const leagueColumns = [
    { key: 'name', label: t('leagues.leagueName'), getValue: (r: TopLeague) => r.name },
    { key: 'season', label: t('leagues.season'), getValue: (r: TopLeague) => r.season || '-' },
    { key: 'quizCount', label: t('leagueDetail.quizCount'), getValue: (r: TopLeague) => r.quizCount, align: 'right' as const },
    { key: 'leaderName', label: t('leagueDetail.leaderOrWinner'), getValue: (r: TopLeague) => r.leaderName, render: (r: TopLeague) => (
      <span>{r.leaderName}</span>
    )},
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold">{t('stats.title')}</h1>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map((c) => (
                <div key={c.label} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{c.label}</span>
                    <c.icon className={`h-5 w-5 ${c.color}`} />
                  </div>
                  <p className="mt-2 text-3xl font-bold font-display">{c.value}</p>
                </div>
              ))}
            </div>

            {/* Top Teams */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-display font-semibold mb-4">{t('stats.topTeams')}</h3>
              <SortableTable data={topTeams} columns={teamColumns} defaultSortKey="quizzes" maxVisible={10} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Best Categories */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-display font-semibold mb-4">{t('stats.bestCategories')}</h3>
                <SortableTable data={bestCategories} columns={catColumns} defaultSortKey="avgPoints" maxVisible={10} />
              </div>

              {/* Best Quizzes */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-display font-semibold mb-4">{t('stats.bestQuizzes')}</h3>
                <SortableTable data={bestQuizzes} columns={quizColumns} defaultSortKey="avgPoints" maxVisible={10} />
              </div>
            </div>

            {/* Top Leagues */}
            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-display font-semibold mb-4">{t('stats.topLeagues')}</h3>
              <SortableTable data={topLeagues} columns={leagueColumns} defaultSortKey="quizCount" maxVisible={10} />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
