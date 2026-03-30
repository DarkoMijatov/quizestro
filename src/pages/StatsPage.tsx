import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Users, FolderOpen, Award, ArrowUpDown, Maximize2, X, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { formatAverage } from '@/lib/number-format';
import { getCompleteCategoryStatsQuizIds } from '@/lib/category-stats';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfMonth, startOfYear, subMonths, subYears } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TopTeam { name: string; quizzes: number; wins: number; avgPoints: number; bestQuizPoints: number; bonusPoints: number }
interface BestCategory { name: string; avgPoints: number }
interface BestQuiz { name: string; date: string; teamCount: number; avgPoints: number }
interface TopLeague { name: string; season: string; quizCount: number; leaderName: string; is_active: boolean }

type SortDir = 'asc' | 'desc';
type StatsRangePreset = 'this_month' | 'last_30_days' | 'last_3_months' | 'last_6_months' | 'last_year' | 'this_year' | 'all_time' | 'custom';
type StatsSectionKey = 'teams' | 'categories' | 'quizzes' | 'leagues';

const SECTION_PAGE_SIZE = 8;

function getRangeFromPreset(preset: StatsRangePreset) {
  const today = new Date();
  switch (preset) {
    case 'this_month':
      return { from: startOfMonth(today), to: today };
    case 'last_30_days':
      return { from: subMonths(today, 1), to: today };
    case 'last_3_months':
      return { from: subMonths(today, 3), to: today };
    case 'last_6_months':
      return { from: subMonths(today, 6), to: today };
    case 'last_year':
      return { from: subYears(today, 1), to: today };
    case 'this_year':
      return { from: startOfYear(today), to: today };
    case 'all_time':
    default:
      return { from: undefined, to: undefined };
  }
}

function SortableTable<T>({ data, columns, defaultSortKey, defaultSortDir = 'desc' }: {
  data: T[];
  columns: { key: string; label: string; getValue: (row: T) => string | number; align?: 'left' | 'right'; render?: (row: T) => React.ReactNode }[];
  defaultSortKey: string;
  defaultSortDir?: SortDir;
}) {
  const { t, i18n } = useTranslation();
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);
  const [page, setPage] = useState(1);

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
    setPage(1);
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  if (data.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">{t('stats.noData')}</p>;

  const totalPages = Math.max(1, Math.ceil(sorted.length / SECTION_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * SECTION_PAGE_SIZE;
  const visible = sorted.slice(startIndex, startIndex + SECTION_PAGE_SIZE);

  return (
    <div className="space-y-4">
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
                <td className="py-2.5 px-3 font-bold text-muted-foreground">{startIndex + i + 1}</td>
                {columns.map(col => {
                  const rawValue = col.getValue(row);
                  const content = col.render
                    ? col.render(row)
                    : typeof rawValue === 'number' && col.key === 'avgPoints'
                      ? formatAverage(rawValue, i18n.language)
                      : rawValue;

                  return (
                    <td key={col.key} className={`py-2.5 px-3 ${col.align === 'right' ? 'text-right' : ''} ${col.key === 'name' ? 'font-medium' : ''} ${col.key === 'avgPoints' || col.key === 'totalPoints' ? 'font-semibold text-primary' : ''}`}>
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {startIndex + 1}–{Math.min(startIndex + SECTION_PAGE_SIZE, sorted.length)} / {sorted.length}
          </p>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage(Math.max(1, safePage - 1))}
                  className={safePage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink isActive>{safePage}</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                  className={safePage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}

function StatsSection({
  title,
  sectionKey,
  expandedSection,
  onExpand,
  children,
}: {
  title: string;
  sectionKey: StatsSectionKey;
  expandedSection: StatsSectionKey | null;
  onExpand: (section: StatsSectionKey | null) => void;
  children: ReactNode;
}) {
  const isExpanded = expandedSection === sectionKey;
  const card = (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="font-display font-semibold">{title}</h3>
        <Button variant="ghost" size="icon" onClick={() => onExpand(isExpanded ? null : sectionKey)}>
          {isExpanded ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
      {children}
    </div>
  );

  if (!isExpanded) return card;

  return (
    <div className="fixed inset-0 z-[120] bg-background/80 backdrop-blur-sm p-4 md:p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">{card}</div>
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
  const [rangePreset, setRangePreset] = useState<StatsRangePreset>('all_time');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>(undefined);
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>(undefined);
  const [expandedSection, setExpandedSection] = useState<StatsSectionKey | null>(null);

  const activeRange = useMemo(() => {
    if (rangePreset === 'custom') {
      return { from: customDateFrom, to: customDateTo };
    }
    return getRangeFromPreset(rangePreset);
  }, [rangePreset, customDateFrom, customDateTo]);

  const customRangeInvalid = useMemo(() => {
    if (rangePreset !== 'custom' || !customDateFrom || !customDateTo) return false;
    return customDateFrom > customDateTo;
  }, [rangePreset, customDateFrom, customDateTo]);

  const fetchQuizzesWithCategoryStatus = async (dateFrom?: Date, dateTo?: Date) => {
    let withFlag = supabase
      .from('quizzes')
      .select('id, name, date, status, league_id, scoring_mode, categories_filled')
      .eq('organization_id', currentOrg!.id);
    if (dateFrom) withFlag = withFlag.gte('date', format(dateFrom, 'yyyy-MM-dd'));
    if (dateTo) withFlag = withFlag.lte('date', format(dateTo, 'yyyy-MM-dd'));
    const withFlagRes = await withFlag;

    if (!withFlagRes.error) {
      return (withFlagRes.data || []) as any[];
    }

    let fallback = supabase
      .from('quizzes')
      .select('id, name, date, status, league_id, scoring_mode')
      .eq('organization_id', currentOrg!.id);
    if (dateFrom) fallback = fallback.gte('date', format(dateFrom, 'yyyy-MM-dd'));
    if (dateTo) fallback = fallback.lte('date', format(dateTo, 'yyyy-MM-dd'));
    const fallbackRes = await fallback;

    return (fallbackRes.data || []).map((quiz: any) => ({
      ...quiz,
      categories_filled: quiz.scoring_mode !== 'per_part',
    })) as any[];
  };

  // Load counts immediately
  useEffect(() => {
    if (!currentOrg) return;
    if (customRangeInvalid) {
      setCounts({ quizzes: 0, teams: 0, categories: 0, leagues: 0 });
      setCountsLoading(false);
      return;
    }
    setCountsLoading(true);
    const loadCounts = async () => {
      try {
        const quizzes = await fetchQuizzesWithCategoryStatus(activeRange.from, activeRange.to);
        const filteredQuizIds = quizzes.map((q: any) => q.id);
        const filteredLeagueIds = new Set(quizzes.map((q: any) => q.league_id).filter(Boolean));

        if (filteredQuizIds.length === 0) {
          setCounts({ quizzes: 0, teams: 0, categories: 0, leagues: 0 });
          return;
        }

        const [qtRes, qcRes] = await Promise.all([
          supabase.from('quiz_teams').select('team_id, quiz_id').in('quiz_id', filteredQuizIds).eq('organization_id', currentOrg.id),
          supabase.from('quiz_categories').select('category_id, quiz_id').in('quiz_id', filteredQuizIds).eq('organization_id', currentOrg.id),
        ]);

        setCounts({
          quizzes: filteredQuizIds.length,
          teams: new Set((qtRes.data || []).map((qt: any) => qt.team_id)).size,
          categories: new Set((qcRes.data || []).map((qc: any) => qc.category_id)).size,
          leagues: filteredLeagueIds.size,
        });
      } catch (error) {
        console.error('Failed to load stats counts', error);
        setCounts({ quizzes: 0, teams: 0, categories: 0, leagues: 0 });
      } finally {
        setCountsLoading(false);
      }
    };

    loadCounts();
  }, [currentOrg?.id, activeRange.from, activeRange.to, customRangeInvalid]);

  // Load base data then compute sections independently
  useEffect(() => {
    if (!currentOrg) return;
    if (customRangeInvalid) {
      setTopTeams([]);
      setBestCategories([]);
      setBestQuizzes([]);
      setTopLeagues([]);
      setTeamsLoading(false);
      setCatsLoading(false);
      setQuizzesLoading(false);
      setLeaguesLoading(false);
      return;
    }
    setTeamsLoading(true);
    setCatsLoading(true);
    setQuizzesLoading(true);
    setLeaguesLoading(true);

    const loadAll = async () => {
      try {
        const allQuizzes = await fetchQuizzesWithCategoryStatus(activeRange.from, activeRange.to);
        const filteredQuizIds = allQuizzes.map((q: any) => q.id);

        if (filteredQuizIds.length === 0) {
          setTopTeams([]);
          setBestCategories([]);
          setBestQuizzes([]);
          setTopLeagues([]);
          return;
        }

        const filteredLeagueIds = [...new Set(allQuizzes.map((quiz: any) => quiz.league_id).filter(Boolean))];
        const [qtRes, scoresRes, qcRes, leaguesRes, partScoresRes, helpTypesRes, helpUsagesRes, categoryBonusesRes] = await Promise.all([
          supabase.from('quiz_teams').select('team_id, quiz_id, total_points, rank').in('quiz_id', filteredQuizIds).eq('organization_id', currentOrg.id),
          supabase.from('scores').select('quiz_category_id, quiz_id, quiz_team_id, points, bonus_points').in('quiz_id', filteredQuizIds).eq('organization_id', currentOrg.id),
          supabase.from('quiz_categories').select('id, quiz_id, category_id, quiz_part_id').in('quiz_id', filteredQuizIds).eq('organization_id', currentOrg.id),
          filteredLeagueIds.length > 0
            ? supabase.from('leagues').select('id, name, season, is_active').in('id', filteredLeagueIds).eq('organization_id', currentOrg.id)
            : Promise.resolve({ data: [], error: null } as any),
          supabase.from('part_scores').select('quiz_id, quiz_team_id, points').in('quiz_id', filteredQuizIds).eq('organization_id', currentOrg.id),
          supabase.from('help_types').select('id, effect').eq('organization_id', currentOrg.id),
          supabase.from('help_usages').select('quiz_id, quiz_team_id, quiz_category_id, help_type_id').in('quiz_id', filteredQuizIds).eq('organization_id', currentOrg.id),
          supabase.from('category_bonuses').select('quiz_id, quiz_team_id, quiz_category_id').in('quiz_id', filteredQuizIds).eq('organization_id', currentOrg.id),
        ]);

        const qtForRange = qtRes.data || [];
        const scoresForRange = scoresRes.data || [];
        const qcForRange = qcRes.data || [];
        const leaguesForRange = leaguesRes.data || [];
        const partScoresForRange = partScoresRes.data || [];
        const helpUsagesForRange = helpUsagesRes.data || [];
        const categoryBonusesForRange = categoryBonusesRes.data || [];
        const jokerHelpTypeIds = (helpTypesRes.data || [])
          .filter((helpType: any) => helpType.effect === 'double')
          .map((helpType: any) => helpType.id);
        const finishedQuizIds = new Set(allQuizzes.filter(q => q.status === 'finished').map(q => q.id));
        const qtFinished = qtForRange.filter(qt => finishedQuizIds.has(qt.quiz_id));
        const quizMap = new Map(allQuizzes.map(q => [q.id, q]));

        if (qtFinished.length === 0) {
          setTopTeams([]);
          setBestQuizzes([]);
        } else {
          // Count category_bonuses per team
          const bonusCountByTeam: Record<string, number> = {};
          const finishedQtIdToTeam = new Map<string, string>();
          // We need quiz_team ids for finished quizzes - fetch them
          const { data: finishedQtFull } = await supabase
            .from('quiz_teams')
            .select('id, team_id, quiz_id')
            .in('quiz_id', [...finishedQuizIds])
            .eq('organization_id', currentOrg.id);
          (finishedQtFull || []).forEach((qt: any) => finishedQtIdToTeam.set(qt.id, qt.team_id));
          const finishedQtIdSet = new Set((finishedQtFull || []).map((qt: any) => qt.id));
          const { data: cbData } = finishedQtIdSet.size > 0
            ? await supabase.from('category_bonuses').select('quiz_team_id').in('quiz_team_id', [...finishedQtIdSet])
            : { data: [] as any[] };
          (cbData || []).forEach((cb: any) => {
            const teamId = finishedQtIdToTeam.get(cb.quiz_team_id);
            if (teamId) bonusCountByTeam[teamId] = (bonusCountByTeam[teamId] || 0) + 1;
          });

          const teamStats: Record<string, { quizzes: number; wins: number; totalPoints: number; bestQuizPoints: number; bonusPoints: number }> = {};
          const quizStats: Record<string, { totalPoints: number; teamCount: number }> = {};

          for (const qt of qtFinished) {
            const tid = qt.team_id;
            const qid = qt.quiz_id;
            if (!teamStats[tid]) teamStats[tid] = { quizzes: 0, wins: 0, totalPoints: 0, bestQuizPoints: 0, bonusPoints: 0 };
            if (!quizStats[qid]) quizStats[qid] = { totalPoints: 0, teamCount: 0 };

            const pts = Number(qt.total_points) || 0;
            teamStats[tid].quizzes++;
            teamStats[tid].totalPoints += pts;
            teamStats[tid].bestQuizPoints = Math.max(teamStats[tid].bestQuizPoints, pts);
            if (qt.rank === 1) teamStats[tid].wins++;

            quizStats[qid].totalPoints += pts;
            quizStats[qid].teamCount++;
          }

          // Assign bonus counts
          for (const [teamId, count] of Object.entries(bonusCountByTeam)) {
            if (teamStats[teamId]) teamStats[teamId].bonusPoints = count;
          }

          const [teamNamesRes] = await Promise.all([
            supabase.from('teams').select('id, name').in('id', Object.keys(teamStats)),
          ]);
          const teamNameMap = new Map((teamNamesRes.data || []).map(t => [t.id, t.name]));

          setTopTeams(
            Object.entries(teamStats)
              .map(([id, s]) => ({
                name: teamNameMap.get(id) || '?',
                quizzes: s.quizzes,
                wins: s.wins,
                avgPoints: s.quizzes > 0 ? s.totalPoints / s.quizzes : 0,
                bestQuizPoints: s.bestQuizPoints,
                bonusPoints: s.bonusPoints,
              }))
              .sort((a, b) => b.avgPoints - a.avgPoints)
          );

          setBestQuizzes(
            Object.entries(quizStats)
              .map(([id, s]) => {
                const quiz = quizMap.get(id);
                return {
                  name: quiz?.name || '?',
                  date: quiz?.date || '',
                  teamCount: s.teamCount,
                  avgPoints: s.teamCount > 0 ? s.totalPoints / s.teamCount : 0,
                };
              })
              .sort((a, b) => b.avgPoints - a.avgPoints)
          );
        }

        const validCategoryQuizIds = getCompleteCategoryStatsQuizIds({
          quizzes: allQuizzes,
          scores: scoresForRange,
          partScores: partScoresForRange,
          helpUsages: helpUsagesForRange,
          categoryBonuses: categoryBonusesForRange,
          jokerHelpTypeIds,
        });

        const finishedScores = scoresForRange.filter((score: any) => validCategoryQuizIds.has(score.quiz_id));
        if (finishedScores.length === 0) {
          setBestCategories([]);
        } else {
          const qcMap = new Map(qcForRange.map((qc: any) => [qc.id, qc.category_id]));
          const catStats: Record<string, { total: number; count: number }> = {};

          for (const score of finishedScores) {
            const catId = qcMap.get(score.quiz_category_id);
            if (!catId) continue;
            if (!catStats[catId]) catStats[catId] = { total: 0, count: 0 };
            catStats[catId].total += Number(score.points || 0);
            catStats[catId].count++;
          }

          const catIds = Object.keys(catStats);
          if (catIds.length === 0) {
            setBestCategories([]);
          } else {
            const { data: catNames } = await supabase.from('categories').select('id, name').in('id', catIds);
            const catNameMap = new Map((catNames || []).map(c => [c.id, c.name]));
            setBestCategories(
              Object.entries(catStats)
                .map(([id, s]) => ({
                  name: catNameMap.get(id) || '?',
                  avgPoints: s.count > 0 ? s.total / s.count : 0,
                }))
                .sort((a, b) => b.avgPoints - a.avgPoints)
            );
          }
        }

        if (leaguesForRange.length === 0) {
          setTopLeagues([]);
        } else {
          const leagueQuizMap: Record<string, { count: number; finishedIds: string[] }> = {};
          for (const quiz of allQuizzes) {
            const leagueId = quiz.league_id;
            if (!leagueId) continue;
            if (!leagueQuizMap[leagueId]) leagueQuizMap[leagueId] = { count: 0, finishedIds: [] };
            leagueQuizMap[leagueId].count++;
            if (quiz.status === 'finished') {
              leagueQuizMap[leagueId].finishedIds.push(quiz.id);
            }
          }

          const leagueLeaders: Record<string, string> = {};
          for (const [leagueId, info] of Object.entries(leagueQuizMap)) {
            if (info.finishedIds.length === 0) continue;
            const finishedSet = new Set(info.finishedIds);
            const teamPoints: Record<string, number> = {};

            for (const qt of qtFinished) {
              if (finishedSet.has(qt.quiz_id)) {
                teamPoints[qt.team_id] = (teamPoints[qt.team_id] || 0) + (Number(qt.total_points) || 0);
              }
            }

            let maxTeamId = '';
            let maxPoints = -1;
            for (const [teamId, points] of Object.entries(teamPoints)) {
              if (points > maxPoints) {
                maxPoints = points;
                maxTeamId = teamId;
              }
            }

            if (maxTeamId) {
              leagueLeaders[leagueId] = maxTeamId;
            }
          }

          const leaderIds = Object.values(leagueLeaders);
          const leaderNamesRes = leaderIds.length > 0
            ? await supabase.from('teams').select('id, name').in('id', leaderIds)
            : { data: [] as any[] };
          const leaderNameMap = new Map((leaderNamesRes.data || []).map(t => [t.id, t.name]));

          setTopLeagues(
            leaguesForRange
              .map((league: any) => ({
                name: league.name,
                season: league.season || '',
                is_active: league.is_active,
                quizCount: leagueQuizMap[league.id]?.count || 0,
                leaderName: leagueLeaders[league.id] ? (leaderNameMap.get(leagueLeaders[league.id]) || '?') : '-',
              }))
              .sort((a, b) => b.quizCount - a.quizCount)
          );
        }
      } catch (error) {
        console.error('Failed to load stats', error);
        toast.error(t('stats.loadError', 'Greška pri učitavanju statistike.'));
        setTopTeams([]);
        setBestCategories([]);
        setBestQuizzes([]);
        setTopLeagues([]);
      } finally {
        setTeamsLoading(false);
        setCatsLoading(false);
        setQuizzesLoading(false);
        setLeaguesLoading(false);
      }
    };

    loadAll();
  }, [currentOrg?.id, activeRange.from, activeRange.to, customRangeInvalid, t]);

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
    { key: 'bestQuizPoints', label: t('teamsTable.bestQuizPoints', 'Najviše poena'), getValue: (r: TopTeam) => r.bestQuizPoints, align: 'right' as const },
    { key: 'bonusPoints', label: t('teamsTable.bonusPoints', 'Bonus'), getValue: (r: TopTeam) => r.bonusPoints, align: 'right' as const },
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

  const statsFilterUI = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={rangePreset} onValueChange={(value) => setRangePreset(value as StatsRangePreset)}>
        <SelectTrigger className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this_month">{t('stats.thisMonth', 'Ovog meseca')}</SelectItem>
          <SelectItem value="last_30_days">{t('stats.last30Days', 'Proteklih mesec dana')}</SelectItem>
          <SelectItem value="last_3_months">{t('stats.last3Months', 'Protekla 3 meseca')}</SelectItem>
          <SelectItem value="last_6_months">{t('stats.last6Months', 'Proteklih 6 meseci')}</SelectItem>
          <SelectItem value="last_year">{t('stats.lastYear', 'Proteklih godinu dana')}</SelectItem>
          <SelectItem value="this_year">{t('stats.thisYear', 'Ove godine')}</SelectItem>
          <SelectItem value="all_time">{t('stats.allTime', 'Svih vremena')}</SelectItem>
          <SelectItem value="custom">{t('stats.customRange', 'Custom')}</SelectItem>
        </SelectContent>
      </Select>
      {rangePreset === 'custom' && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2 w-[140px] justify-start text-left font-normal", !customDateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4" />
                {customDateFrom ? format(customDateFrom, 'dd.MM.yyyy') : t('filters.dateFrom')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("gap-2 w-[140px] justify-start text-left font-normal", !customDateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4" />
                {customDateTo ? format(customDateTo, 'dd.MM.yyyy') : t('filters.dateTo')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {(customDateFrom || customDateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setCustomDateFrom(undefined); setCustomDateTo(undefined); }}>
              {t('filters.clearDates')}
            </Button>
          )}
        </>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl font-bold">{t('stats.title')}</h1>
          {statsFilterUI}
        </div>

        {customRangeInvalid && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {t('stats.invalidCustomRange', 'Datum od ne može biti posle datuma do.')}
          </div>
        )}

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
        <StatsSection title={t('stats.topTeams')} sectionKey="teams" expandedSection={expandedSection} onExpand={setExpandedSection}>
          {teamsLoading ? <SectionSkeleton /> : <SortableTable data={topTeams} columns={teamColumns} defaultSortKey="quizzes" />}
        </StatsSection>

        <div className="grid lg:grid-cols-2 gap-6">
          <StatsSection title={t('stats.bestCategories')} sectionKey="categories" expandedSection={expandedSection} onExpand={setExpandedSection}>
            {catsLoading ? <SectionSkeleton /> : <SortableTable data={bestCategories} columns={catColumns} defaultSortKey="avgPoints" />}
          </StatsSection>

          <StatsSection title={t('stats.bestQuizzes')} sectionKey="quizzes" expandedSection={expandedSection} onExpand={setExpandedSection}>
            {quizzesLoading ? <SectionSkeleton /> : <SortableTable data={bestQuizzes} columns={quizColumns} defaultSortKey="avgPoints" />}
          </StatsSection>
        </div>

        <StatsSection title={t('stats.topLeagues')} sectionKey="leagues" expandedSection={expandedSection} onExpand={setExpandedSection}>
          {leaguesLoading ? <SectionSkeleton /> : <SortableTable data={topLeagues} columns={leagueColumns} defaultSortKey="quizCount" />}
        </StatsSection>
      </div>
    </DashboardLayout>
  );
}
