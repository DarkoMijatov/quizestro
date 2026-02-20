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
  ArrowLeft, Loader2, Trophy, Star, Zap, Lock, Unlock, Play, CheckCircle,
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
      // Update ranks and totals
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/quizzes')} className="gap-1 mb-2">
              <ArrowLeft className="h-4 w-4" /> {t('common.back')}
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold">{quiz.name}</h1>
              <Badge variant="outline" className={statusConfig[quiz.status].color}>
                {quiz.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {format(new Date(quiz.date), 'PPP')}
              {quiz.location && ` · ${quiz.location}`}
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              {quiz.status === 'draft' && (
                <Button onClick={() => updateQuizStatus('live')} className="gap-2">
                  <Play className="h-4 w-4" /> {t('scoring.goLive')}
                </Button>
              )}
              {quiz.status === 'live' && (
                <Button onClick={() => updateQuizStatus('finished')} variant="secondary" className="gap-2">
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

        {/* Scoring Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left p-3 font-semibold sticky left-0 bg-muted/50 min-w-[140px] z-10">
                    #
                  </th>
                  <th className="text-left p-3 font-semibold sticky left-10 bg-muted/50 min-w-[160px] z-10">
                    {t('scoring.team')}
                  </th>
                  {categories.map((cat) => (
                    <th key={cat.id} className="text-center p-3 font-semibold min-w-[120px]">
                      {(cat.category as any)?.name || cat.category_id}
                    </th>
                  ))}
                  <th className="text-center p-3 font-semibold min-w-[90px] bg-primary/5">
                    {t('scoring.total')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankedTeams.map((team, idx) => {
                  const total = getTeamTotal(team.id);
                  const teamName = team.alias || (team.team as any)?.name || '';
                  return (
                    <tr key={team.id} className={cn('border-b border-border last:border-0', idx === 0 && 'bg-primary/[0.02]')}>
                      <td className="p-3 sticky left-0 bg-card font-bold text-muted-foreground z-10">
                        {idx + 1}
                      </td>
                      <td className="p-3 sticky left-10 bg-card z-10">
                        <div className="flex items-center gap-2">
                          {idx === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                          <span className="font-medium">{teamName}</span>
                        </div>
                      </td>
                      {categories.map((cat) => {
                        const score = getScore(team.id, cat.id);
                        const hasJoker = jokerType && getHelpUsage(team.id, cat.id, jokerType.id);
                        const hasMarker = markerType && getHelpUsage(team.id, cat.id, markerType.id);
                        const isFinished = quiz.status === 'finished';

                        return (
                          <td key={cat.id} className={cn('p-2 text-center', hasJoker && 'bg-yellow-500/5')}>
                            {canEdit && !isFinished ? (
                              <div className="space-y-1">
                                <Input
                                  type="number"
                                  min={0}
                                  value={score?.points ?? 0}
                                  onChange={(e) => score && updateScore(score.id, 'points', Number(e.target.value) || 0)}
                                  className="h-8 w-16 mx-auto text-center text-sm"
                                />
                                <Input
                                  type="number"
                                  min={0}
                                  value={score?.bonus_points ?? 0}
                                  onChange={(e) => score && updateScore(score.id, 'bonus_points', Number(e.target.value) || 0)}
                                  className="h-7 w-16 mx-auto text-center text-xs text-muted-foreground"
                                  placeholder="bonus"
                                />
                                <div className="flex items-center justify-center gap-1">
                                  {jokerType && (
                                    <button
                                      onClick={() => toggleHelp(team.id, cat.id, jokerType)}
                                      className={cn(
                                        'p-1 rounded transition-colors',
                                        hasJoker ? 'bg-yellow-500 text-white' : 'text-muted-foreground hover:text-yellow-500'
                                      )}
                                      title="Joker (x2)"
                                      disabled={!hasJoker && hasTeamUsedHelp(team.id, jokerType.id)}
                                    >
                                      <Star className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  {markerType && (
                                    <button
                                      onClick={() => toggleHelp(team.id, cat.id, markerType)}
                                      className={cn(
                                        'p-1 rounded transition-colors',
                                        hasMarker ? 'bg-blue-500 text-white' : 'text-muted-foreground hover:text-blue-500'
                                      )}
                                      title="Double Chance"
                                      disabled={!hasMarker && hasTeamUsedHelp(team.id, markerType.id)}
                                    >
                                      <Zap className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <p className="font-medium">
                                  {(score?.points ?? 0) + (score?.bonus_points ?? 0)}
                                  {hasJoker && <span className="text-yellow-500 text-xs ml-1">×2</span>}
                                </p>
                                <div className="flex items-center justify-center gap-0.5">
                                  {hasJoker && <Star className="h-3 w-3 text-yellow-500" />}
                                  {hasMarker && <Zap className="h-3 w-3 text-blue-500" />}
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-3 text-center bg-primary/5">
                        <span className="font-bold text-lg">{total}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {jokerType && (
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 text-yellow-500" /> Joker (×2 {t('scoring.points')})
            </span>
          )}
          {markerType && (
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-blue-500" /> Double Chance
            </span>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
