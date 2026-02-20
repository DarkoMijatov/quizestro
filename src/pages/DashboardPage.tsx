import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, FolderOpen, Award, Plus, Loader2, Calendar, MapPin, ArrowRight, Zap } from 'lucide-react';
import { useOrganizations } from '@/hooks/useOrganizations';
import { format } from 'date-fns';

interface RecentQuiz {
  id: string;
  name: string;
  date: string;
  location: string | null;
  status: 'draft' | 'live' | 'finished';
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  live: 'bg-primary/10 text-primary border-primary/30',
  finished: 'bg-accent text-accent-foreground',
};

export default function DashboardPage() {
  const { t } = useTranslation();
  const { currentOrg, currentRole } = useOrganizations();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ quizzes: 0, teams: 0, categories: 0, leagues: 0 });
  const [recentQuizzes, setRecentQuizzes] = useState<RecentQuiz[]>([]);
  const [totalQuizCount, setTotalQuizCount] = useState(0);

  const isFree = currentOrg?.subscription_tier === 'free';
  const TOTAL_LIMIT = 10;

  useEffect(() => {
    if (!currentOrg) return;
    const load = async () => {
      setLoading(true);

      const [q, tm, c, l, recent] = await Promise.all([
        supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
        supabase.from('teams').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).eq('is_deleted', false),
        supabase.from('categories').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).eq('is_deleted', false),
        supabase.from('leagues').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
        supabase.from('quizzes').select('id, name, date, location, status').eq('organization_id', currentOrg.id).order('date', { ascending: false }).limit(5),
      ]);

      setCounts({
        quizzes: q.count || 0,
        teams: tm.count || 0,
        categories: c.count || 0,
        leagues: l.count || 0,
      });
      setRecentQuizzes((recent.data as RecentQuiz[]) || []);
      setTotalQuizCount(q.count || 0);
      setLoading(false);
    };
    load();
  }, [currentOrg?.id]);

  const stats = [
    { label: t('dashboard.quizzes'), value: counts.quizzes, icon: Trophy, color: 'text-primary', path: '/dashboard/quizzes' },
    { label: t('dashboard.teams'), value: counts.teams, icon: Users, color: 'text-blue-500', path: '/dashboard/teams' },
    { label: t('dashboard.categories'), value: counts.categories, icon: FolderOpen, color: 'text-emerald-500', path: '/dashboard/categories' },
    { label: t('dashboard.leagues'), value: counts.leagues, icon: Award, color: 'text-purple-500', path: '/dashboard/leagues' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">{t('dashboard.welcome')} 👋</h1>
            <p className="text-muted-foreground mt-1">
              {currentOrg?.name} · <span className="capitalize">{currentRole}</span>
            </p>
          </div>
          <Link to="/dashboard/quizzes/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t('dashboard.createQuiz')}
            </Button>
          </Link>
        </div>

        {/* Free tier usage banner */}
        {isFree && (
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{t('freemium.freeplan')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('freemium.quizzesUsed', { used: totalQuizCount, limit: TOTAL_LIMIT })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min((totalQuizCount / TOTAL_LIMIT) * 100, 100)}%` }}
                />
              </div>
              <Button size="sm" variant="outline" className="gap-1 shrink-0">
                <Zap className="h-3 w-3" />
                {t('freemium.upgrade')}
              </Button>
            </div>
          </div>
        )}

        {/* Stats grid */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.map((s) => (
                <Link key={s.label} to={s.path}>
                  <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors cursor-pointer group">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{s.label}</span>
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                    </div>
                    <p className="mt-2 text-3xl font-bold font-display">{s.value}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      <span>{t('common.viewAll')}</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Recent quizzes */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold">{t('dashboard.recentQuizzes')}</h2>
                {recentQuizzes.length > 0 && (
                  <Link to="/dashboard/quizzes" className="text-sm text-primary hover:underline flex items-center gap-1">
                    {t('common.viewAll')} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              {recentQuizzes.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-12 text-center">
                  <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">{t('dashboard.noQuizzes')}</p>
                  <Link to="/dashboard/quizzes/new">
                    <Button className="mt-4 gap-2">
                      <Plus className="h-4 w-4" />
                      {t('dashboard.createQuiz')}
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-3">
                  {recentQuizzes.map((quiz) => (
                    <Link key={quiz.id} to={`/dashboard/quizzes/${quiz.id}`}>
                      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{quiz.name}</p>
                            <Badge variant="outline" className={statusColors[quiz.status]}>
                              {quiz.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(quiz.date), 'PPP')}
                            </span>
                            {quiz.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {quiz.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
