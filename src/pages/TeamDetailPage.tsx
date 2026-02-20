import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Tag, Trophy, Calendar, MapPin, Loader2, TrendingUp, Hash } from 'lucide-react';

interface TeamAlias {
  id: string;
  alias: string;
}

interface QuizParticipation {
  quiz_id: string;
  quiz_name: string;
  quiz_date: string;
  quiz_location: string | null;
  quiz_status: string;
  alias: string | null;
  total_points: number | null;
  rank: number | null;
}

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentOrg } = useOrganizations();

  const [team, setTeam] = useState<{ id: string; name: string } | null>(null);
  const [aliases, setAliases] = useState<TeamAlias[]>([]);
  const [participations, setParticipations] = useState<QuizParticipation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !currentOrg) return;
    const fetchAll = async () => {
      setLoading(true);

      const [{ data: teamData }, { data: aliasData }, { data: qtData }] = await Promise.all([
        supabase.from('teams').select('id, name').eq('id', id).single(),
        supabase.from('team_aliases').select('id, alias').eq('team_id', id),
        supabase.from('quiz_teams').select('quiz_id, alias, total_points, rank').eq('team_id', id).eq('organization_id', currentOrg.id),
      ]);

      setTeam(teamData as any);
      setAliases((aliasData as any) || []);

      // Fetch quiz details for participations
      const quizIds = (qtData || []).map((qt: any) => qt.quiz_id);
      if (quizIds.length > 0) {
        const { data: quizzes } = await supabase
          .from('quizzes')
          .select('id, name, date, location, status')
          .in('id', quizIds)
          .order('date', { ascending: false });

        const quizMap = new Map((quizzes || []).map((q: any) => [q.id, q]));
        const merged: QuizParticipation[] = (qtData || []).map((qt: any) => {
          const q = quizMap.get(qt.quiz_id) || {};
          return {
            quiz_id: qt.quiz_id,
            quiz_name: (q as any).name || '—',
            quiz_date: (q as any).date || '',
            quiz_location: (q as any).location || null,
            quiz_status: (q as any).status || '',
            alias: qt.alias,
            total_points: qt.total_points,
            rank: qt.rank,
          };
        }).sort((a: QuizParticipation, b: QuizParticipation) => b.quiz_date.localeCompare(a.quiz_date));

        setParticipations(merged);
      } else {
        setParticipations([]);
      }

      setLoading(false);
    };
    fetchAll();
  }, [id, currentOrg?.id]);

  const totalQuizzes = participations.length;
  const avgPoints = totalQuizzes > 0
    ? (participations.reduce((s, p) => s + (p.total_points || 0), 0) / totalQuizzes).toFixed(1)
    : '0';
  const bestRank = participations.reduce((best, p) => (p.rank && (best === 0 || p.rank < best) ? p.rank : best), 0);
  const wins = participations.filter((p) => p.rank === 1).length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  if (!team) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">{t('common.noResults')}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/teams')}>
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/teams')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">{team.name}</h1>
            {aliases.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {aliases.map((a) => (
                  <span key={a.id} className="inline-flex items-center gap-1 text-xs rounded-full bg-accent px-2 py-0.5 text-accent-foreground">
                    <Tag className="h-3 w-3" />{a.alias}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <Hash className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{totalQuizzes}</p>
            <p className="text-xs text-muted-foreground">{t('teamDetail.quizzesPlayed')}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{avgPoints}</p>
            <p className="text-xs text-muted-foreground">{t('teamDetail.avgPoints')}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <Trophy className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{wins}</p>
            <p className="text-xs text-muted-foreground">{t('teamDetail.wins')}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <Trophy className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{bestRank > 0 ? `#${bestRank}` : '—'}</p>
            <p className="text-xs text-muted-foreground">{t('teamDetail.bestRank')}</p>
          </div>
        </div>

        {/* Quiz history */}
        <div>
          <h2 className="font-display text-lg font-semibold mb-3">{t('teamDetail.quizHistory')}</h2>
          {participations.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">{t('teamDetail.noHistory')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {participations.map((p) => (
                <div
                  key={p.quiz_id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/dashboard/quizzes/${p.quiz_id}`)}
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{p.quiz_name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{p.quiz_date}</span>
                      {p.quiz_location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.quiz_location}</span>}
                      {p.alias && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{p.alias}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {p.rank && (
                      <Badge variant={p.rank === 1 ? 'default' : 'secondary'}>
                        #{p.rank}
                      </Badge>
                    )}
                    <span className="text-lg font-bold">{p.total_points ?? 0}</span>
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
