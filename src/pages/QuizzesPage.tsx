import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trophy, Loader2, MapPin, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Quiz {
  id: string;
  name: string;
  date: string;
  location: string | null;
  status: 'draft' | 'live' | 'finished';
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  live: 'bg-primary/10 text-primary border-primary/30',
  finished: 'bg-accent text-accent-foreground',
};

export default function QuizzesPage() {
  const { t } = useTranslation();
  const { currentOrg, currentRole } = useOrganizations();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  const canCreate = currentRole === 'owner' || currentRole === 'admin';

  useEffect(() => {
    if (!currentOrg) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('quizzes')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('date', { ascending: false }) as { data: Quiz[] | null };
      setQuizzes(data || []);
      setLoading(false);
    };
    fetch();
  }, [currentOrg?.id]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">{t('dashboard.quizzes')}</h1>
          {canCreate && (
            <Link to="/dashboard/quizzes/new">
              <Button className="gap-2"><Plus className="h-4 w-4" />{t('dashboard.createQuiz')}</Button>
            </Link>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : quizzes.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('dashboard.noQuizzes')}</p>
            {canCreate && (
              <Link to="/dashboard/quizzes/new">
                <Button className="mt-4 gap-2"><Plus className="h-4 w-4" />{t('dashboard.createQuiz')}</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {quizzes.map((quiz) => (
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
