import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Users, FolderOpen, Award, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopTeam { name: string; quizzes: number; wins: number; avgPoints: number }
interface BestCategory { name: string; avgPoints: number }
interface BestQuiz { name: string; date: string; teamCount: number; avgPoints: number }
interface TopLeague { name: string; season: string; quizCount: number; leaderName: string; is_active: boolean }

type SortDir = 'asc' | 'desc';

const TOP_N = 10;

function SortableTable<T>({ data, columns, defaultSortKey, defaultSortDir = 'desc' }: {
  data: T[];
  columns: { key: string; label: string; getValue: (row: T) => string | number; align?: 'left' | 'right'; render?: (row: T) => React.ReactNode }[];
  defaultSortKey: string;
  defaultSortDir?: SortDir;
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

  const visible = sorted.slice(0, TOP_N);

  return (
    <div className="overflow-auto">
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
          {visible.map((row, i) => (
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

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export default function StatsPage() {
  const { t } = useTranslation();
  const { currentOrg } = useOrganizations();

  const [countsLoading, setCountsLoading] = useState(true);
  const [counts, setCounts] = useState({ quizzes: 0, teams: 0, categories: 0, leagues: 0 });

  const [teamsLoading, setTeamsLoading] = useState(true);
  const [topTeams, setTopTeams] = useState<TopTeam[]>([]);

  const [catsLoading, setCatsLoading] = useState(true);
  const [bestCategories, setBestCategories] = useState<BestCategory[]>([]);

  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [bestQuizzes, setBestQuizzes] = useState<BestQuiz[]>([]);

  const [leaguesLoading, setLeaguesLoading] = useState(true);
  const [topLeagues, setTopLeagues] = useState<TopLeague[]>([]);

  // Load counts immediately
  useEffect(() => {
    if (!currentOrg) return;
    setCountsLoading(true);
    Promise.all([
      supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
      supabase.from('teams').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).eq('is_deleted', false),
      supabase.from('categories').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).eq('is_deleted', false),
      supabase.from('leagues').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
    ]).then(([q, tm, c, l]) => {
      setCounts({ quizzes: q.count || 0, teams: tm.count || 0, categories: c.count || 0, leagues: l.count || 0 });
      setCountsLoading(false);
    });
  }, [currentOrg?.id]);

  // Load base data then compute sections independently
  useEffect(() => {
    if (!currentOrg) return;
    setTeamsLoading(true);
    setCatsLoading(true);
    setQuizzesLoading(true);
    setLeaguesLoading(true);

    const loadAll = async () => {
      // Fetch base data in parallel
      const [quizzesRes, qtRes, scoresRes, leaguesRes] = await Promise.all([
        supabase.from('quizzes').select('id, name, date, status, league_id').eq('organization_id', currentOrg.id),
        supabase.from('quiz_teams').select('team_id, quiz_id, total_points, rank').eq('organization_id', currentOrg.id),
        supabase.from('scores').select('quiz_category_id, quiz_id, points, bonus_points').eq('organization_id', currentOrg.id),
        supabase.from('leagues').select('id, name, season, is_active').eq('organization_id', currentOrg.id),
      ]);

      const allQuizzes = quizzesRes.data || [];
      const allQt = qtRes.data || [];
      const allScores = scoresRes.data || [];
      const allLeagues = leaguesRes.data || [];
      const finishedQuizIds = new Set(allQuizzes.filter(q => q.status === 'finished').map(q => q.id));
      const qtFinished = allQt.filter(qt => finishedQuizIds.has(qt.quiz_id));

      // === Top Teams (async, independent) ===
      (async () => {
        if (qtFinished.length === 0) { setTopTeams([]); setTeamsLoading(false); return; }
        const teamStats: Record<string, { quizzes: number; wins: number; totalPoints: number }> = {};
        for (const qt of qtFinished) {
          const tid = qt.team_id;
          if (!teamStats[tid]) teamStats[tid] = { quizzes: 0, wins: 0, totalPoints: 0 };
          teamStats[tid].quizzes++;
          teamStats[tid].totalPoints += Number(qt.total_points) || 0;
          if (qt.rank === 1) teamStats[tid].wins++;
        }
        const teamIds = Object.keys(teamStats);
        const { data: teamNames } = await supabase.from('teams').select('id, name').in('id', teamIds);
        const nameMap = new Map((teamNames || []).map(t => [t.id, t.name]));
        setTopTeams(
          Object.entries(teamStats)
            .map(([id, s]) => ({
              name: nameMap.get(id) || '?',
              quizzes: s.quizzes,
              wins: s.wins,
              avgPoints: s.quizzes > 0 ? Math.round((s.totalPoints / s.quizzes) * 10) / 10 : 0,
            }))
            .sort((a, b) => b.quizzes - a.quizzes)
            .slice(0, TOP_N)
        );
        setTeamsLoading(false);
      })();

      // === Best Categories (async, independent) ===
      (async () => {
        const finishedScores = allScores.filter(s => finishedQuizIds.has(s.quiz_id));
        if (finishedScores.length === 0) { setBestCategories([]); setCatsLoading(false); return; }
        const { data: qcData } = await supabase.from('quiz_categories').select('id, category_id').eq('organization_id', currentOrg.id);
        const qcMap = new Map((qcData || []).map(qc => [qc.id, qc.category_id]));
        const catStats: Record<string, { total: number; count: number }> = {};
        for (const s of finishedScores) {
          const catId = qcMap.get(s.quiz_category_id);
          if (!catId) continue;
          if (!catStats[catId]) catStats[catId] = { total: 0, count: 0 };
          catStats[catId].total += Number(s.points) + Number(s.bonus_points);
          catStats[catId].count++;
        }
        const catIds = Object.keys(catStats);
        if (catIds.length === 0) { setBestCategories([]); setCatsLoading(false); return; }
        const { data: catNames } = await supabase.from('categories').select('id, name').in('id', catIds);
        const cNameMap = new Map((catNames || []).map(c => [c.id, c.name]));
        setBestCategories(
          Object.entries(catStats)
            .map(([id, s]) => ({
              name: cNameMap.get(id) || '?',
              avgPoints: s.count > 0 ? Math.round((s.total / s.count) * 10) / 10 : 0,
            }))
            .sort((a, b) => b.avgPoints - a.avgPoints)
            .slice(0, TOP_N)
        );
        setCatsLoading(false);
      })();

      // === Best Quizzes (sync, fast) ===
      (() => {
        if (qtFinished.length === 0) { setBestQuizzes([]); setQuizzesLoading(false); return; }
        const quizStats: Record<string, { totalPoints: number; teamCount: number }> = {};
        for (const qt of qtFinished) {
          const qid = qt.quiz_id;
          if (!quizStats[qid]) quizStats[qid] = { totalPoints: 0, teamCount: 0 };
          quizStats[qid].totalPoints += Number(qt.total_points) || 0;
          quizStats[qid].teamCount++;
        }
        const quizMap = new Map(allQuizzes.map(q => [q.id, q]));
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
            .slice(0, TOP_N)
        );
        setQuizzesLoading(false);
      })();

      // === Top Leagues (async, independent) ===
      (async () => {
        if (allLeagues.length === 0) { setTopLeagues([]); setLeaguesLoading(false); return; }
        const leagueQuizMap: Record<string, { count: number; finishedIds: string[] }> = {};
        for (const quiz of allQuizzes) {
          const lid = quiz.league_id;
          if (!lid) continue;
          if (!leagueQuizMap[lid]) leagueQuizMap[lid] = { count: 0, finishedIds: [] };
          leagueQuizMap[lid].count++;
          if (quiz.status === 'finished') leagueQuizMap[lid].finishedIds.push(quiz.id);
        }

        const leagueLeaders: Record<string, string> = {};
        for (const [lid, info] of Object.entries(leagueQuizMap)) {
          if (info.finishedIds.length === 0) continue;
          const finishedSet = new Set(info.finishedIds);
          const teamPts: Record<string, number> = {};
          for (const qt of qtFinished) {
            if (finishedSet.has(qt.quiz_id)) {
              teamPts[qt.team_id] = (teamPts[qt.team_id] || 0) + (Number(qt.total_points) || 0);
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
          leaderNameMap = new Map((tn || []).map(t => [t.id, t.name]));
        }

        setTopLeagues(
          allLeagues.map(l => ({
            name: l.name,
            season: l.season || '',
            is_active: l.is_active,
            quizCount: leagueQuizMap[l.id]?.count || 0,
            leaderName: leagueLeaders[l.id] ? (leaderNameMap.get(leagueLeaders[l.id]) || '?') : '-',
          }))
          .sort((a, b) => b.quizCount - a.quizCount)
          .slice(0, TOP_N)
        );
        setLeaguesLoading(false);
      })();
    };

    loadAll();
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

        {/* Counts - show skeleton or values */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </div>
              {countsLoading ? (
                <Skeleton className="h-9 w-16 mt-2" />
              ) : (
                <p className="mt-2 text-3xl font-bold font-display">{c.value}</p>
              )}
            </div>
          ))}
        </div>

        {/* Top Teams */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-display font-semibold mb-4">{t('stats.topTeams')}</h3>
          {teamsLoading ? <SectionSkeleton /> : <SortableTable data={topTeams} columns={teamColumns} defaultSortKey="quizzes" />}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Best Categories */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-display font-semibold mb-4">{t('stats.bestCategories')}</h3>
            {catsLoading ? <SectionSkeleton /> : <SortableTable data={bestCategories} columns={catColumns} defaultSortKey="avgPoints" />}
          </div>

          {/* Best Quizzes */}
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-display font-semibold mb-4">{t('stats.bestQuizzes')}</h3>
            {quizzesLoading ? <SectionSkeleton /> : <SortableTable data={bestQuizzes} columns={quizColumns} defaultSortKey="avgPoints" />}
          </div>
        </div>

        {/* Top Leagues */}
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="font-display font-semibold mb-4">{t('stats.topLeagues')}</h3>
          {leaguesLoading ? <SectionSkeleton /> : <SortableTable data={topLeagues} columns={leagueColumns} defaultSortKey="quizCount" />}
        </div>
      </div>
    </DashboardLayout>
  );
}
