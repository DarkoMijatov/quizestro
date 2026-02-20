import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Loader2, Play, CheckCircle, Unlock,
} from 'lucide-react';
import { format } from 'date-fns';

interface QuizData {
  id: string;
  name: string;
  date: string;
  location: string | null;
  status: 'draft' | 'live' | 'finished';
  organization_id: string;
}

interface QuizCategory {
  id: string;
  category_id: string;
  sort_order: number | null;
  category: { name: string };
}

interface QuizTeam {
  id: string;
  team_id: string;
  alias: string | null;
  total_points: number | null;
  rank: number | null;
  team: { name: string };
}

interface Score {
  id: string;
  quiz_team_id: string;
  quiz_category_id: string;
  points: number;
  bonus_points: number;
  is_locked: boolean;
}

interface HelpType {
  id: string;
  name: string;
  effect: string;
}

interface HelpUsage {
  id: string;
  help_type_id: string;
  quiz_team_id: string;
  quiz_category_id: string;
}

const statusConfig = {
  draft: { color: 'bg-muted text-muted-foreground', icon: null },
  live: { color: 'bg-primary/10 text-primary border-primary/30', icon: Play },
  finished: { color: 'bg-accent text-accent-foreground', icon: CheckCircle },
};

export default function QuizDetailPage() {
  const { t } = useTranslation();
  const { id: quizId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [teams, setTeams] = useState<QuizTeam[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [helpTypes, setHelpTypes] = useState<HelpType[]>([]);
  const [helpUsages, setHelpUsages] = useState<HelpUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingScores, setSavingScores] = useState<Set<string>>(new Set());

  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const fetchAll = useCallback(async () => {
    if (!quizId || !currentOrg) return;
    setLoading(true);

    const [quizRes, catRes, teamRes, scoreRes, helpTypeRes, helpUsageRes] = await Promise.all([
      supabase.from('quizzes').select('*').eq('id', quizId).single(),
      supabase.from('quiz_categories').select('*, category:categories(name)').eq('quiz_id', quizId).order('sort_order'),
      supabase.from('quiz_teams').select('*, team:teams(name)').eq('quiz_id', quizId).order('total_points', { ascending: false }),
      supabase.from('scores').select('*').eq('quiz_id', quizId),
      supabase.from('help_types').select('*').eq('organization_id', currentOrg.id),
      supabase.from('help_usages').select('*').eq('quiz_id', quizId),
    ]);

    setQuiz(quizRes.data as any);
    setCategories((catRes.data as any) || []);
    setTeams((teamRes.data as any) || []);
    setScores((scoreRes.data as any) || []);
    setHelpTypes((helpTypeRes.data as any) || []);
    setHelpUsages((helpUsageRes.data as any) || []);
    setLoading(false);
  }, [quizId, currentOrg?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const getScore = (teamId: string, catId: string) =>
    scores.find((s) => s.quiz_team_id === teamId && s.quiz_category_id === catId);

  const getHelpUsage = (teamId: string, catId: string, helpTypeId: string) =>
    helpUsages.find((h) => h.quiz_team_id === teamId && h.quiz_category_id === catId && h.help_type_id === helpTypeId);

  const jokerType = helpTypes.find((h) => h.effect === 'double');
  const markerType = helpTypes.find((h) => h.effect === 'marker');

  const hasTeamUsedHelp = (teamId: string, helpTypeId: string) =>
    helpUsages.some((h) => h.quiz_team_id === teamId && h.help_type_id === helpTypeId);

  const updateScore = async (scoreId: string, field: 'points' | 'bonus_points', value: number) => {
    setSavingScores((prev) => new Set(prev).add(scoreId));
    const update: any = { [field]: value };
    await supabase.from('scores').update(update).eq('id', scoreId);

    setScores((prev) =>
      prev.map((s) => (s.id === scoreId ? { ...s, [field]: value } : s))
    );
    setSavingScores((prev) => {
      const next = new Set(prev);
      next.delete(scoreId);
      return next;
    });
  };

  const toggleHelp = async (teamId: string, catId: string, helpType: HelpType) => {
    if (!currentOrg || !quizId) return;
    const existing = getHelpUsage(teamId, catId, helpType.id);

    if (existing) {
      await supabase.from('help_usages').delete().eq('id', existing.id);
      setHelpUsages((prev) => prev.filter((h) => h.id !== existing.id));
    } else {
      if (hasTeamUsedHelp(teamId, helpType.id)) {
        toast({ title: t('scoring.helpAlreadyUsed'), variant: 'destructive' });
        return;
      }
      const { data } = await supabase.from('help_usages').insert({
        help_type_id: helpType.id,
        quiz_team_id: teamId,
        quiz_category_id: catId,
        quiz_id: quizId,
        organization_id: currentOrg.id,
      }).select().single();
      if (data) setHelpUsages((prev) => [...prev, data as any]);
    }
  };

  const getTeamTotal = (teamId: string) => {
    let total = 0;
    for (const cat of categories) {
      const score = getScore(teamId, cat.id);
      if (!score) continue;
      let catPoints = score.points + score.bonus_points;
      if (jokerType && getHelpUsage(teamId, cat.id, jokerType.id)) {
        catPoints *= 2;
      }
      total += catPoints;
    }
    return total;
  };

  const rankedTeams = [...teams].sort((a, b) => getTeamTotal(b.id) - getTeamTotal(a.id));

  const updateQuizStatus = async (status: 'draft' | 'live' | 'finished') => {
    if (!quizId) return;
    await supabase.from('quizzes').update({ status }).eq('id', quizId);
    setQuiz((prev) => prev ? { ...prev, status } : prev);

    if (status === 'finished') {
      for (let i = 0; i < rankedTeams.length; i++) {
        const team = rankedTeams[i];
        await supabase.from('quiz_teams').update({
          total_points: getTeamTotal(team.id),
          rank: i + 1,
        }).eq('id', team.id);
      }
    }
    toast({ title: '✓', description: t('scoring.statusUpdated') });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!quiz) {
    return (
      <DashboardLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">{t('scoring.notFound')}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/quizzes')}>
            {t('common.back')}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isFinished = quiz.status === 'finished';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/quizzes')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-display text-2xl md:text-3xl font-bold">{quiz.name}</h1>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              {quiz.status === 'draft' && (
                <Button onClick={() => updateQuizStatus('live')} className="gap-2">
                  <Play className="h-4 w-4" /> {t('scoring.goLive')}
                </Button>
              )}
              {quiz.status === 'live' && (
                <Button onClick={() => updateQuizStatus('finished')} className="gap-2">
                  <CheckCircle className="h-4 w-4" /> {t('scoring.finish')}
                </Button>
              )}
              {quiz.status === 'finished' && (
                <Button onClick={() => updateQuizStatus('live')} variant="outline" className="gap-2">
                  <Unlock className="h-4 w-4" /> {t('scoring.reopen')}
                </Button>
              )}
            </div>
          )}
        </div>

          {/* Scoring Card */}
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Column Headers */}
          <div className="grid border-b border-border bg-muted/30" style={{
            gridTemplateColumns: `minmax(140px, 1.2fr) ${categories.map(() => 'minmax(80px, 1fr)').join(' ')} minmax(70px, 0.5fr)`,
          }}>
            <div className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('scoring.team')}
            </div>
            {categories.map((cat) => (
              <div key={cat.id} className="p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center border-l border-border truncate">
                {(cat.category as any)?.name || cat.category_id}
              </div>
            ))}
            <div className="p-3 text-xs font-semibold uppercase tracking-wider text-primary text-center border-l border-border">
              {t('scoring.total')}
            </div>
          </div>

          {/* Team Rows */}
          {rankedTeams.map((team, idx) => {
            const total = getTeamTotal(team.id);
            const teamName = team.alias || (team.team as any)?.name || '';
            const originalName = (team.team as any)?.name || '';

            return (
              <div
                key={team.id}
                className={cn(
                  'grid border-b border-border last:border-0 transition-colors',
                  idx === 0 && 'bg-primary/[0.02]',
                )}
                style={{
                  gridTemplateColumns: `minmax(140px, 1.2fr) ${categories.map(() => 'minmax(80px, 1fr)').join(' ')} minmax(70px, 0.5fr)`,
                }}
              >
                {/* Rank + Team */}
                <div className="p-3 flex items-center gap-2">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{teamName}</p>
                    {team.alias && originalName && (
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{originalName}</p>
                    )}
                  </div>
                </div>

                {/* Category Scores */}
                {categories.map((cat) => {
                  const score = getScore(team.id, cat.id);
                  const hasJoker = jokerType && getHelpUsage(team.id, cat.id, jokerType.id);

                  return (
                    <div key={cat.id} className={cn('p-2 flex flex-col items-center justify-center gap-1 border-l border-border', hasJoker && 'bg-primary/[0.04]')}>
                      {canEdit && !isFinished ? (
                        <>
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={score?.points ?? 0}
                            onChange={(e) => score && updateScore(score.id, 'points', Number(e.target.value) || 0)}
                            className="h-12 w-full text-center text-xl font-bold border-muted"
                          />
                          {/* Help buttons */}
                          <div className="flex items-center gap-1">
                            {jokerType && (
                              <button
                                onClick={() => toggleHelp(team.id, cat.id, jokerType)}
                                className={cn(
                                  'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
                                  hasJoker
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-muted-foreground border-border hover:border-primary hover:text-primary',
                                )}
                                disabled={!hasJoker && hasTeamUsedHelp(team.id, jokerType.id)}
                              >
                                {jokerType.name}
                              </button>
                            )}
                            {markerType && (() => {
                              const hasMarker = getHelpUsage(team.id, cat.id, markerType.id);
                              return (
                                <button
                                  onClick={() => toggleHelp(team.id, cat.id, markerType)}
                                  className={cn(
                                    'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
                                    hasMarker
                                      ? 'bg-accent text-accent-foreground border-accent'
                                      : 'bg-background text-muted-foreground border-border hover:border-accent hover:text-accent-foreground',
                                  )}
                                  disabled={!hasMarker && hasTeamUsedHelp(team.id, markerType.id)}
                                >
                                  {markerType.name}
                                </button>
                              );
                            })()}
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-0.5">
                          <p className="text-xl font-bold">
                            {score?.points ?? 0}
                          </p>
                          {hasJoker && (
                            <span className="text-[10px] text-primary font-medium">×2</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Total */}
                <div className="p-2 flex items-center justify-center border-l border-border">
                  <span className="text-2xl font-bold text-primary">{total % 1 === 0 ? total : total.toFixed(1)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
