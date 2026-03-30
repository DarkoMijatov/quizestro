import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DataTable, Column, FilterConfig, ServerParams } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Plus, Trophy, Eye, Pencil, Trash2, Calendar as CalendarIcon, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { srLatn } from 'date-fns/locale';
import { formatAverage } from '@/lib/number-format';

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

const PAGE_SIZE = 8;

export default function QuizzesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [deleteItem, setDeleteItem] = useState<QuizRow | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [serverParams, setServerParams] = useState<ServerParams>({
    page: 1, pageSize: PAGE_SIZE, search: '', sortKey: 'date', sortDir: 'desc', filters: {},
  });

  const canCreate = currentRole === 'owner' || currentRole === 'admin';
  const canDelete = currentRole === 'owner' || currentRole === 'admin';

  const fetchQuizzes = useCallback(async (params: ServerParams, from?: Date, to?: Date) => {
    if (!currentOrg) return;
    setLoading(true);

    // Build count query
    let countQuery = supabase
      .from('quizzes')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', currentOrg.id);

    // Build data query
    let dataQuery = supabase
      .from('quizzes')
      .select('id, name, date, location, status')
      .eq('organization_id', currentOrg.id);

    // Apply status filter
    const statusFilter = params.filters.status;
    if (statusFilter && statusFilter !== 'all') {
      countQuery = countQuery.eq('status', statusFilter as 'draft' | 'live' | 'finished');
      dataQuery = dataQuery.eq('status', statusFilter as 'draft' | 'live' | 'finished');
    }

    // Apply date filters
    if (from) {
      const fromStr = format(from, 'yyyy-MM-dd');
      countQuery = countQuery.gte('date', fromStr);
      dataQuery = dataQuery.gte('date', fromStr);
    }
    if (to) {
      const toStr = format(to, 'yyyy-MM-dd');
      countQuery = countQuery.lte('date', toStr);
      dataQuery = dataQuery.lte('date', toStr);
    }

    // Apply search (server-side ilike on name and location)
    if (params.search) {
      const searchPattern = `%${params.search}%`;
      countQuery = countQuery.or(`name.ilike.${searchPattern},location.ilike.${searchPattern}`);
      dataQuery = dataQuery.or(`name.ilike.${searchPattern},location.ilike.${searchPattern}`);
    }

    // Apply sorting
    const sortCol = params.sortKey || 'date';
    const ascending = params.sortDir === 'asc';
     if (['name', 'date', 'location', 'status'].includes(sortCol)) {
      dataQuery = dataQuery.order(sortCol, { ascending });
    } else {
      dataQuery = dataQuery.order('date', { ascending: false });
    }

    // Apply pagination
    const rangeFrom = (params.page - 1) * params.pageSize;
    const rangeTo = rangeFrom + params.pageSize - 1;
    dataQuery = dataQuery.range(rangeFrom, rangeTo);

    // Execute both queries
    const [countRes, dataRes] = await Promise.all([countQuery, dataQuery]);

    setTotalCount(countRes.count || 0);

    const qList = (dataRes.data || []) as any[];
    if (qList.length === 0) {
      setQuizzes([]);
      setLoading(false);
      return;
    }

    // Fetch aggregates for current page quizzes only
    const quizIds = qList.map((q) => q.id);
    const { data: qtData } = await supabase
      .from('quiz_teams')
      .select('quiz_id, team_id, total_points, rank, teams(name)')
      .in('quiz_id', quizIds);

    const qtList = (qtData || []) as any[];
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
        avgPoints: agg && agg.teamCount > 0 ? agg.totalPoints / agg.teamCount : null,
      };
    }));
    setLoading(false);
  }, [currentOrg?.id]);

  // Initial load and when date filters change
  useEffect(() => {
    fetchQuizzes(serverParams, dateFrom, dateTo);
  }, [currentOrg?.id, dateFrom, dateTo]);

  const handleServerChange = useCallback((params: ServerParams) => {
    setServerParams(params);
    fetchQuizzes(params, dateFrom, dateTo);
  }, [fetchQuizzes, dateFrom, dateTo]);

  const handleDelete = async () => {
    if (!deleteItem) return;
    await supabase.from('quizzes').delete().eq('id', deleteItem.id);
    toast({ title: '✓', description: t('quizzes.deleted') });
    setDeleteItem(null);
    // Refresh current page
    fetchQuizzes(serverParams, dateFrom, dateTo);
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
      render: (r) => {
        const lang = i18n.language;
        return lang === 'sr'
          ? format(new Date(r.date), 'dd. MMMM yyyy.', { locale: srLatn })
          : format(new Date(r.date), 'MMM dd, yyyy');
      },
      getValue: (r) => r.date,
    },
    {
      key: 'location', label: t('quiz.location'), sortable: true,
      render: (r) => r.location || '—',
      getValue: (r) => r.location,
    },
    {
      key: 'teamCount', label: t('quizzes.teamCount'),
      getValue: (r) => r.teamCount,
    },
    {
      key: 'winner', label: t('quizzes.winner'),
      render: (r) => r.winner || '—',
      getValue: (r) => r.winner,
    },
    {
      key: 'avgPoints', label: t('quizzes.avgPoints'),
      render: (r) => r.avgPoints != null ? formatAverage(r.avgPoints, i18n.language) : '—',
      getValue: (r) => r.avgPoints,
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/quizzes/${r.id}`)}>
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.view', 'Pogledaj')}</TooltipContent>
          </Tooltip>
          {canCreate && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/quizzes/${r.id}`)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.edit')}</TooltipContent>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => setDeleteItem(r)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.delete')}</TooltipContent>
            </Tooltip>
          )}
        </div>
      ),
    },
  ], [t, canCreate, canDelete, navigate]);

  const dateFiltersUI = (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("gap-2 w-[140px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
            <CalendarIcon className="h-4 w-4" />
            {dateFrom ? format(dateFrom, 'dd.MM.yyyy') : t('filters.dateFrom')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn("gap-2 w-[140px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
            <CalendarIcon className="h-4 w-4" />
            {dateTo ? format(dateTo, 'dd.MM.yyyy') : t('filters.dateTo')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      {(dateFrom || dateTo) && (
        <Button variant="ghost" size="icon" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
          <X className="h-4 w-4" />
        </Button>
      )}
      {canCreate && (
        <Link to="/dashboard/quizzes/new">
          <Button className="gap-2"><Plus className="h-4 w-4" />{t('dashboard.createQuiz')}</Button>
        </Link>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <DataTable
        columns={columns}
        data={quizzes}
        loading={loading}
        pageSize={PAGE_SIZE}
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
        headerActions={dateFiltersUI}
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
        serverSide
        totalCount={totalCount}
        onServerChange={handleServerChange}
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
