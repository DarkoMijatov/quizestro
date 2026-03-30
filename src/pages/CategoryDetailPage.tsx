import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { ArrowLeft, FolderOpen, Calendar, MapPin, Loader2, Hash, TrendingUp, BarChart3 } from 'lucide-react';
import { formatAverage } from '@/lib/number-format';

interface QuizUsage {
  quiz_id: string;
  quiz_name: string;
  quiz_date: string;
  quiz_location: string | null;
  quiz_status: string;
  sort_order: number | null;
  avg_score: number;
  teams_count: number;
}

interface TeamCategoryAverageRow {
  team_id: string;
  team_name: string;
  avg_score: number;
  appearances: number;
}

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentOrg } = useOrganizations();

  const [category, setCategory] = useState<{ id: string; name: string } | null>(null);
  const [usages, setUsages] = useState<QuizUsage[]>([]);
  const [teamAverages, setTeamAverages] = useState<TeamCategoryAverageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamPage, setTeamPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  const PAGE_SIZE = 10;

  useEffect(() => {
    if (!id || !currentOrg) return;
    const fetchAll = async () => {
      setLoading(true);

      const [{ data: catData }, { data: qcData }] = await Promise.all([
        supabase.from('categories').select('id, name').eq('id', id).single(),
        supabase.from('quiz_categories').select('quiz_id, sort_order, id').eq('category_id', id).eq('organization_id', currentOrg.id),
      ]);

      setCategory(catData as any);

      const quizIds = (qcData || []).map((qc: any) => qc.quiz_id);

      if (quizIds.length > 0) {
        const quizzesWithFlag = await supabase.from('quizzes').select('id, name, date, location, status, scoring_mode, categories_filled').in('id', quizIds).order('date', { ascending: false });
        const quizzesFallback = quizzesWithFlag.error
          ? await supabase.from('quizzes').select('id, name, date, location, status, scoring_mode').in('id', quizIds).order('date', { ascending: false })
          : null;
        const quizzes = quizzesWithFlag.error
          ? (quizzesFallback?.data || []).map((quiz: any) => ({
              ...quiz,
              categories_filled: quiz.scoring_mode !== 'per_part',
            }))
          : (quizzesWithFlag.data || []);

        const [{ data: allQuizCategories }, { data: quizTeams }] = await Promise.all([
          supabase.from('quiz_categories').select('id, quiz_id').in('quiz_id', quizIds),
          supabase.from('quiz_teams').select('id, quiz_id, team_id, teams(name)').in('quiz_id', quizIds),
        ]);
        const allQuizCategoryIds = (allQuizCategories || []).map((qc: any) => qc.id);
        const { data: scores } = allQuizCategoryIds.length > 0
          ? await supabase.from('scores').select('quiz_id, quiz_team_id, quiz_category_id, points, bonus_points').in('quiz_category_id', allQuizCategoryIds)
          : { data: [] as any[] };

        const quizMap = new Map((quizzes || []).map((q: any) => [q.id, q]));
        const completePerPartQuizIds = new Set(
          (quizzes || [])
            .filter((quiz: any) => quiz.scoring_mode === 'per_part' && Boolean(quiz.categories_filled))
            .map((quiz: any) => quiz.id)
        );
        
        // Group scores by quiz_category_id
        const scoresByQC = new Map<string, { total: number; count: number }>();
        (scores || []).forEach((s: any) => {
          const existing = scoresByQC.get(s.quiz_category_id) || { total: 0, count: 0 };
          existing.total += (s.points || 0) + (s.bonus_points || 0);
          existing.count += 1;
          scoresByQC.set(s.quiz_category_id, existing);
        });

        const merged: QuizUsage[] = (qcData || [])
          .filter((qc: any) => {
            const quiz = quizMap.get(qc.quiz_id);
            if (!quiz) return false;
            if (quiz.scoring_mode !== 'per_part') return true;
            return completePerPartQuizIds.has(qc.quiz_id);
          })
          .map((qc: any) => {
            const q = quizMap.get(qc.quiz_id) || {};
            const sc = scoresByQC.get(qc.id) || { total: 0, count: 0 };
            return {
              quiz_id: qc.quiz_id,
              quiz_name: (q as any).name || '—',
              quiz_date: (q as any).date || '',
              quiz_location: (q as any).location || null,
              quiz_status: (q as any).status || '',
              sort_order: qc.sort_order,
              avg_score: sc.count > 0 ? sc.total / sc.count : 0,
              teams_count: sc.count,
            };
          })
          .sort((a: QuizUsage, b: QuizUsage) => b.quiz_date.localeCompare(a.quiz_date));

        setUsages(merged);

        const validQuizIds = new Set(
          (qcData || [])
            .filter((qc: any) => {
              const quiz = quizMap.get(qc.quiz_id);
              if (!quiz) return false;
              if (quiz.scoring_mode !== 'per_part') return true;
              return completePerPartQuizIds.has(qc.quiz_id);
            })
            .map((qc: any) => qc.quiz_id)
        );
        const targetQuizCategoryIds = new Set((qcData || []).map((qc: any) => qc.id));
        const teamMap = new Map((quizTeams || []).map((qt: any) => [qt.id, { team_id: qt.team_id, team_name: qt.teams?.name || '—' }]));
        const teamStats = new Map<string, { team_id: string; team_name: string; total: number; count: number }>();

        (scores || [])
          .filter((score: any) => validQuizIds.has(score.quiz_id) && targetQuizCategoryIds.has(score.quiz_category_id))
          .forEach((score: any) => {
            const teamInfo = teamMap.get(score.quiz_team_id);
            if (!teamInfo) return;
            const existing = teamStats.get(teamInfo.team_id) || { ...teamInfo, total: 0, count: 0 };
            existing.total += Number(score.points || 0) + Number(score.bonus_points || 0);
            existing.count += 1;
            teamStats.set(teamInfo.team_id, existing);
          });

        setTeamAverages(
          Array.from(teamStats.values())
            .map((item) => ({
              team_id: item.team_id,
              team_name: item.team_name,
              avg_score: item.count > 0 ? item.total / item.count : 0,
              appearances: item.count,
            }))
            .sort((a, b) => b.avg_score - a.avg_score)
        );
      } else {
        setUsages([]);
        setTeamAverages([]);
      }

      setLoading(false);
    };
    fetchAll();
  }, [id, currentOrg?.id]);

  const totalUsed = usages.length;
  const finishedUsages = usages.filter((u) => u.quiz_status === 'finished');
  const overallAvg = finishedUsages.length > 0
    ? formatAverage(finishedUsages.reduce((s, u) => s + u.avg_score, 0) / finishedUsages.length, i18n.language)
    : formatAverage(0, i18n.language);
  const highestAvg = finishedUsages.length > 0
    ? formatAverage(Math.max(...finishedUsages.map((u) => u.avg_score)), i18n.language)
    : formatAverage(0, i18n.language);
  const totalTeamPages = Math.max(1, Math.ceil(teamAverages.length / PAGE_SIZE));
  const safeTeamPage = Math.min(teamPage, totalTeamPages);
  const visibleTeamAverages = teamAverages.slice((safeTeamPage - 1) * PAGE_SIZE, safeTeamPage * PAGE_SIZE);
  const totalHistoryPages = Math.max(1, Math.ceil(usages.length / PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages);
  const visibleUsages = usages.slice((safeHistoryPage - 1) * PAGE_SIZE, safeHistoryPage * PAGE_SIZE);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  if (!category) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">{t('common.noResults')}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/categories')}>
            <ArrowLeft className="h-4 w-4 mr-2" />{t('common.back')}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/categories')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <FolderOpen className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl font-bold">{category.name}</h1>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <Hash className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{totalUsed}</p>
            <p className="text-xs text-muted-foreground">{t('categoryDetail.timesUsed')}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{overallAvg}</p>
            <p className="text-xs text-muted-foreground">{t('categoryDetail.avgScore')}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <BarChart3 className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{highestAvg}</p>
            <p className="text-xs text-muted-foreground">{t('categoryDetail.highestAvg')}</p>
          </div>
        </div>

        {/* Quiz usage history */}
        <div>
          <h2 className="font-display text-lg font-semibold mb-3">{t('categoryDetail.teamAverages', 'Prosek po timovima')}</h2>
          {teamAverages.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center mb-6">
              <p className="text-muted-foreground">{t('categoryDetail.noTeamStats', 'Nema dovoljno podataka za prikaz po timovima.')}</p>
            </div>
          ) : (
            <div className="space-y-2 mb-6">
              {visibleTeamAverages.map((item, index) => (
                <div key={item.team_id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{(safeTeamPage - 1) * PAGE_SIZE + index + 1}. {item.team_name}</p>
                    <p className="text-xs text-muted-foreground">{t('categoryDetail.appearances', 'Broj unosa')}: {item.appearances}</p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-lg font-bold">{formatAverage(item.avg_score, i18n.language)}</p>
                    <p className="text-xs text-muted-foreground">{t('categoryDetail.avgScore')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {teamAverages.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4 mb-6">
              <p className="text-sm text-muted-foreground">
                {(safeTeamPage - 1) * PAGE_SIZE + 1}–{Math.min(safeTeamPage * PAGE_SIZE, teamAverages.length)} / {teamAverages.length}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setTeamPage(Math.max(1, safeTeamPage - 1))}
                      className={safeTeamPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink isActive>{safeTeamPage}</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setTeamPage(Math.min(totalTeamPages, safeTeamPage + 1))}
                      className={safeTeamPage === totalTeamPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          <div>
          <h2 className="font-display text-lg font-semibold mb-3">{t('categoryDetail.quizHistory')}</h2>
          {usages.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">{t('categoryDetail.noHistory')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleUsages.map((u) => (
                <div
                  key={u.quiz_id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/dashboard/quizzes/${u.quiz_id}`)}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.quiz_name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{u.quiz_date}</span>
                      {u.quiz_location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{u.quiz_location}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4 text-sm">
                    <div className="text-center">
                      <p className="text-lg font-bold">{formatAverage(u.avg_score, i18n.language)}</p>
                      <p className="text-xs text-muted-foreground">{t('categoryDetail.avgScore')}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold">{u.teams_count}</p>
                      <p className="text-xs text-muted-foreground">{t('dashboard.teams')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {usages.length > PAGE_SIZE && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {(safeHistoryPage - 1) * PAGE_SIZE + 1}–{Math.min(safeHistoryPage * PAGE_SIZE, usages.length)} / {usages.length}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setHistoryPage(Math.max(1, safeHistoryPage - 1))}
                      className={safeHistoryPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink isActive>{safeHistoryPage}</PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setHistoryPage(Math.min(totalHistoryPages, safeHistoryPage + 1))}
                      className={safeHistoryPage === totalHistoryPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
