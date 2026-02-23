import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DataTable, Column, FilterConfig } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trophy, Eye, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface QuizRow {
  id: string;
  name: string;
  date: string;
  location: string | null;
  status: 'draft' | 'live' | 'finished';
  teamCount: number;
  winner: string | null;
  avgPoints: number | null;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  live: 'bg-primary/10 text-primary border-primary/30',
  finished: 'bg-accent text-accent-foreground',
};

export default function QuizzesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteItem, setDeleteItem] = useState<QuizRow | null>(null);

  const canCreate = currentRole === 'owner' || currentRole === 'admin';
  const canDelete = currentRole === 'owner' || currentRole === 'admin';

  useEffect(() => {
    if (!currentOrg) return;
    const fetchData = async () => {
      setLoading(true);

      // Fetch quizzes
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('id, name, date, location, status')
        .eq('organization_id', currentOrg.id)
        .order('date', { ascending: false });

      const qList = (quizData || []) as any[];
      if (qList.length === 0) { setQuizzes([]); setLoading(false); return; }

      const quizIds = qList.map((q) => q.id);

      // Fetch quiz_teams with team names for counts, winners
      const { data: qtData } = await supabase
        .from('quiz_teams')
        .select('quiz_id, team_id, total_points, rank, teams(name)')
        .in('quiz_id', quizIds);

      const qtList = (qtData || []) as any[];

      // Build aggregates per quiz
      const aggMap = new Map<string, { teamCount: number; winner: string | null; totalPoints: number }>();
      for (const qt of qtList) {
        const agg = aggMap.get(qt.quiz_id) || { teamCount: 0, winner: null, totalPoints: 0 };
        agg.teamCount++;
        agg.totalPoints += Number(qt.total_points || 0);
        if (qt.rank === 1) agg.winner = qt.teams?.name || null;
        aggMap.set(qt.quiz_id, agg);
      }

      setQuizzes(qList.map((q) => {
        const agg = aggMap.get(q.id);
        return {
          ...q,
          teamCount: agg?.teamCount || 0,
          winner: agg?.winner || null,
          avgPoints: agg && agg.teamCount > 0 ? Math.round((agg.totalPoints / agg.teamCount) * 10) / 10 : null,
        };
      }));
      setLoading(false);
    };
    fetchData();
  }, [currentOrg?.id]);

  const handleDelete = async () => {
    if (!deleteItem) return;
    await supabase.from('quizzes').delete().eq('id', deleteItem.id);
    toast({ title: '✓', description: t('quizzes.deleted') });
    setDeleteItem(null);
    setQuizzes((prev) => prev.filter((q) => q.id !== deleteItem.id));
  };

  const columns: Column<QuizRow>[] = useMemo(() => [
    {
      key: 'name', label: t('quiz.name'), sortable: true,
      render: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <Badge variant="outline" className={`mt-1 text-xs ${statusColors[r.status]}`}>{r.status}</Badge>
        </div>
      ),
      getValue: (r) => r.name,
    },
    {
      key: 'date', label: t('quiz.date'), sortable: true,
      render: (r) => format(new Date(r.date), 'dd.MM.yyyy'),
      getValue: (r) => r.date,
    },
    {
      key: 'location', label: t('quiz.location'), sortable: true,
      render: (r) => r.location || '—',
      getValue: (r) => r.location,
    },
    {
      key: 'teamCount', label: t('quizzes.teamCount'), sortable: true,
      getValue: (r) => r.teamCount,
    },
    {
      key: 'winner', label: t('quizzes.winner'), sortable: true,
      render: (r) => r.winner || '—',
      getValue: (r) => r.winner,
    },
    {
      key: 'avgPoints', label: t('quizzes.avgPoints'), sortable: true,
      render: (r) => r.avgPoints != null ? r.avgPoints : '—',
      getValue: (r) => r.avgPoints,
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/quizzes/${r.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          {canCreate && (
            <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/quizzes/${r.id}`)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="icon" onClick={() => setDeleteItem(r)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ], [t, canCreate, canDelete, navigate]);

  return (
    <DashboardLayout>
      <DataTable
        columns={columns}
        data={quizzes}
        loading={loading}
        pageSize={15}
        defaultSortKey="date"
        defaultSortDir="desc"
        title={t('dashboard.quizzes')}
        emptyIcon={<Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto" />}
        emptyMessage={t('dashboard.noQuizzes')}
        emptyAction={canCreate ? (
          <Link to="/dashboard/quizzes/new">
            <Button className="gap-2"><Plus className="h-4 w-4" />{t('dashboard.createQuiz')}</Button>
          </Link>
        ) : undefined}
        headerActions={canCreate ? (
          <Link to="/dashboard/quizzes/new">
            <Button className="gap-2"><Plus className="h-4 w-4" />{t('dashboard.createQuiz')}</Button>
          </Link>
        ) : undefined}
        searchFn={(row, q) => row.name.toLowerCase().includes(q) || (row.location || '').toLowerCase().includes(q) || (row.winner || '').toLowerCase().includes(q)}
        filters={[
          {
            key: 'status',
            label: t('filters.status'),
            allLabel: t('filters.allStatuses'),
            options: [
              { value: 'draft', label: t('filters.draft') },
              { value: 'live', label: t('filters.live') },
              { value: 'finished', label: t('filters.finished') },
            ],
          },
        ]}
        filterFn={(row, filters) => {
          if (filters.status && filters.status !== 'all' && row.status !== filters.status) return false;
          return true;
        }}
        onRowClick={(r) => navigate(`/dashboard/quizzes/${r.id}`)}
      />

      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('quizzes.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
