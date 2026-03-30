import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
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

export default function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { currentOrg } = useOrganizations();

  const [category, setCategory] = useState<{ id: string; name: string } | null>(null);
  const [usages, setUsages] = useState<QuizUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !currentOrg) return;
    const fetchAll = async () => {
      setLoading(true);

      const [{ data: catData }, { data: qcData }] = await Promise.all([
        supabase.from('categories').select('id, name').eq('id', id).single(),
        supabase.from('quiz_categories').select('quiz_id, sort_order, id').eq('category_id', id).eq('organization_id', currentOrg.id),
      ]);

      setCategory(catData as any);

      const quizCatIds = (qcData || []).map((qc: any) => qc.id);
      const quizIds = (qcData || []).map((qc: any) => qc.quiz_id);

      if (quizIds.length > 0) {
        const [{ data: quizzes }, { data: scores }] = await Promise.all([
          supabase.from('quizzes').select('id, name, date, location, status, scoring_mode').in('id', quizIds).order('date', { ascending: false }),
          supabase.from('scores').select('quiz_id, quiz_category_id, points, bonus_points').in('quiz_category_id', quizCatIds),
        ]);

        const quizMap = new Map((quizzes || []).map((q: any) => [q.id, q]));
        const perPartQuizzesWithCategoryScores = new Set(
          (scores || [])
            .filter((s: any) => {
              const quiz = quizMap.get(s.quiz_id);
              if (!quiz || quiz.scoring_mode !== 'per_part') return false;
              return Number(s.points || 0) !== 0 || Number(s.bonus_points || 0) !== 0;
            })
            .map((s: any) => s.quiz_id)
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
            return perPartQuizzesWithCategoryScores.has(qc.quiz_id);
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
      } else {
        setUsages([]);
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
          <h2 className="font-display text-lg font-semibold mb-3">{t('categoryDetail.quizHistory')}</h2>
          {usages.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">{t('categoryDetail.noHistory')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {usages.map((u) => (
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
        </div>
      </div>
    </DashboardLayout>
  );
}
