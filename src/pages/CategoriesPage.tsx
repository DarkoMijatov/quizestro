import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DataTable, Column, ServerParams } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Eye, Pencil, Trash2, FolderOpen, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatAverage } from '@/lib/number-format';
import { getCompleteCategoryStatsQuizIds } from '@/lib/category-stats';

interface CategoryRow {
  id: string;
  name: string;
  organization_id: string;
  is_deleted: boolean;
  is_default: boolean;
  created_at: string;
  avgPoints: number | null;
}

const PAGE_SIZE = 15;

export default function CategoriesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [catName, setCatName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<CategoryRow | null>(null);

  const [serverParams, setServerParams] = useState<ServerParams>({
    page: 1, pageSize: PAGE_SIZE, search: '', sortKey: 'avgPoints', sortDir: 'desc', filters: {},
  });

  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const fetchQuizzesWithCategoryStatus = useCallback(async (quizIds: string[]) => {
    if (quizIds.length === 0) return [];

    const withFlag = await supabase
      .from('quizzes')
      .select('id, scoring_mode, status, categories_filled')
      .in('id', quizIds);

    if (!withFlag.error) {
      return (withFlag.data || []) as any[];
    }

    const fallback = await supabase
      .from('quizzes')
      .select('id, scoring_mode, status')
      .in('id', quizIds);

    return (fallback.data || []).map((quiz: any) => ({
      ...quiz,
      categories_filled: quiz.scoring_mode !== 'per_part',
    })) as any[];
  }, []);

  const fetchCategories = useCallback(async (params: ServerParams) => {
    if (!currentOrg) return;
    setLoading(true);

    try {
      let countQuery = supabase
        .from('categories')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', currentOrg.id)
        .eq('is_deleted', false);

      let dataQuery = supabase
        .from('categories')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .eq('is_deleted', false);

      const defaultFilter = params.filters.is_default;
      if (defaultFilter && defaultFilter !== 'all') {
        const isDefaultVal = defaultFilter === 'true';
        countQuery = countQuery.eq('is_default', isDefaultVal);
        dataQuery = dataQuery.eq('is_default', isDefaultVal);
      }

      if (params.search) {
        const pattern = `%${params.search}%`;
        countQuery = countQuery.ilike('name', pattern);
        dataQuery = dataQuery.ilike('name', pattern);
      }

      const [countRes, dataRes] = await Promise.all([countQuery, dataQuery]);
      setTotalCount(countRes.count || 0);

      const cats = (dataRes.data || []) as CategoryRow[];
      if (cats.length === 0) {
        setCategories([]);
        return;
      }

      const catIds = cats.map((c) => c.id);
      const { data: qcData } = await supabase
        .from('quiz_categories')
        .select('id, category_id, quiz_id')
        .in('category_id', catIds);

      const qcList = (qcData || []) as any[];
      const quizMeta = await fetchQuizzesWithCategoryStatus([...new Set(qcList.map((qc: any) => qc.quiz_id))]);
      const quizMetaMap = new Map(quizMeta.map((q: any) => [q.id, q]));

      const validQuizIds = [...new Set(qcList.map((qc: any) => qc.quiz_id).filter((quizId: string) => {
        const quiz = quizMetaMap.get(quizId);
        return quiz?.status === 'finished';
      }))];

      const [allScoresRes, partScoresRes, helpTypesRes, helpUsagesRes, categoryBonusesRes] = await Promise.all([
        validQuizIds.length > 0
          ? supabase.from('scores').select('quiz_id, quiz_team_id, quiz_category_id, points, bonus_points').in('quiz_id', validQuizIds)
          : Promise.resolve({ data: [] as any[] }),
        validQuizIds.length > 0
          ? supabase.from('part_scores').select('quiz_id, quiz_team_id, points').in('quiz_id', validQuizIds)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from('help_types').select('id, effect').eq('organization_id', currentOrg.id),
        validQuizIds.length > 0
          ? supabase.from('help_usages').select('quiz_id, quiz_team_id, quiz_category_id, help_type_id').in('quiz_id', validQuizIds)
          : Promise.resolve({ data: [] as any[] }),
        validQuizIds.length > 0
          ? supabase.from('category_bonuses').select('quiz_id, quiz_team_id, quiz_category_id').in('quiz_id', validQuizIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const jokerHelpTypeIds = (helpTypesRes.data || [])
        .filter((helpType: any) => helpType.effect === 'double')
        .map((helpType: any) => helpType.id);
      const completeQuizIds = getCompleteCategoryStatsQuizIds({
        quizzes: quizMeta,
        scores: allScoresRes.data || [],
        partScores: partScoresRes.data || [],
        helpUsages: helpUsagesRes.data || [],
        categoryBonuses: categoryBonusesRes.data || [],
        jokerHelpTypeIds,
      });

      const scoreSourceQuizIds = qcList
        .filter((qc: any) => completeQuizIds.has(qc.quiz_id))
        .map((qc: any) => qc.quiz_id);
      const scoreSourceQuizIdSet = new Set(scoreSourceQuizIds);

      const validQcIds = qcList
        .filter((qc: any) => scoreSourceQuizIdSet.has(qc.quiz_id))
        .map((qc: any) => qc.id);
      const validQcIdSet = new Set(validQcIds);

      const qcById = new Map(qcList.map((qc: any) => [qc.id, qc]));
      const jokerUsageSet = new Set(
        (helpUsagesRes.data || [])
          .filter((usage: any) => jokerHelpTypeIds.includes(usage.help_type_id))
          .map((usage: any) => `${usage.quiz_team_id}:${usage.quiz_category_id}`)
      );
      const categoryBonusSet = new Set(
        (categoryBonusesRes.data || []).map((bonus: any) => `${bonus.quiz_team_id}:${bonus.quiz_category_id}`)
      );

      const qcToCat = new Map<string, string>();
      qcList.forEach((qc: any) => qcToCat.set(qc.id, qc.category_id));

      const scoreMap = new Map<string, { total: number; count: number }>();
      (allScoresRes.data || []).forEach((score: any) => {
        const qc = qcById.get(score.quiz_category_id);
        if (!qc || !validQcIdSet.has(qc.id)) return;
        const categoryId = qcToCat.get(score.quiz_category_id);
        if (!categoryId) return;
        const stat = scoreMap.get(categoryId) || { total: 0, count: 0 };
        let displayPoints = Number(score.points || 0) + Number(score.bonus_points || 0);
        if (jokerUsageSet.has(`${score.quiz_team_id}:${score.quiz_category_id}`)) {
          displayPoints *= 2;
        }
        if (categoryBonusSet.has(`${score.quiz_team_id}:${score.quiz_category_id}`)) {
          displayPoints += 1;
        }
        stat.total += displayPoints;
        stat.count += 1;
        scoreMap.set(categoryId, stat);
      });

      const sortedCategories = cats.map((category) => {
        const stat = scoreMap.get(category.id);
        return {
          ...category,
          avgPoints: stat && stat.count > 0 ? stat.total / stat.count : null,
        };
      }).sort((a, b) => {
        const sortKey = params.sortKey || 'avgPoints';
        const sortDir = params.sortDir === 'asc' ? 1 : -1;
        const getSortableValue = (row: CategoryRow) => {
          switch (sortKey) {
            case 'avgPoints':
              return row.avgPoints ?? -1;
            case 'is_default':
              return row.is_default ? 1 : 0;
            case 'created_at':
              return row.created_at;
            case 'name':
            default:
              return row.name;
          }
        };

        const aValue = getSortableValue(a);
        const bValue = getSortableValue(b);
        const comparison = typeof aValue === 'number' && typeof bValue === 'number'
          ? aValue - bValue
          : String(aValue).localeCompare(String(bValue), i18n.language);

        return comparison * sortDir;
      });

      const from = (params.page - 1) * params.pageSize;
      setCategories(sortedCategories.slice(from, from + params.pageSize));
    } catch (error) {
      console.error('Failed to load categories page', error);
      setCategories([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [currentOrg?.id, fetchQuizzesWithCategoryStatus, i18n.language]);

  useEffect(() => { fetchCategories(serverParams); }, [fetchCategories]);

  const handleServerChange = useCallback((params: ServerParams) => {
    setServerParams(params);
    fetchCategories(params);
  }, [fetchCategories]);

  const openCreate = () => { setEditing(null); setCatName(''); setIsDefault(false); setDialogOpen(true); };
  const openEdit = (cat: CategoryRow) => { setEditing(cat); setCatName(cat.name); setIsDefault(cat.is_default); setDialogOpen(true); };

  const handleSave = async () => {
    if (!currentOrg || !catName.trim()) return;
    setSaving(true);
    if (editing) {
      await supabase.from('categories').update({ name: catName.trim(), is_default: isDefault }).eq('id', editing.id);
      toast({ title: '✓', description: t('categories.updated') });
    } else {
      await supabase.from('categories').insert({ name: catName.trim(), organization_id: currentOrg.id, is_default: isDefault });
      toast({ title: '✓', description: t('categories.created') });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchCategories(serverParams);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await supabase.from('categories').update({ is_deleted: true }).eq('id', deleteItem.id);
    toast({ title: '✓', description: t('categories.deleted') });
    setDeleteItem(null);
    fetchCategories(serverParams);
  };

  const columns: Column<CategoryRow>[] = useMemo(() => [
    {
      key: 'name', label: t('categories.categoryName'), sortable: true,
      render: (r) => <p className="font-medium">{r.name}</p>,
      getValue: (r) => r.name,
    },
    {
      key: 'avgPoints', label: t('categoriesTable.avgPoints'), sortable: true,
      render: (r) => r.avgPoints != null ? formatAverage(r.avgPoints, i18n.language) : '—',
      getValue: (r) => r.avgPoints,
    },
    {
      key: 'is_default', label: t('categoriesTable.isDefault'), sortable: true,
      render: (r) => r.is_default
        ? <Badge variant="default" className="text-xs">{t('categoriesTable.default')}</Badge>
        : <span className="text-muted-foreground text-xs">{t('categoriesTable.notDefault')}</span>,
      getValue: (r) => r.is_default ? 1 : 0,
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/categories/${r.id}`)}>
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.view', 'Pogledaj')}</TooltipContent>
          </Tooltip>
          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.edit')}</TooltipContent>
            </Tooltip>
          )}
          {canEdit && (
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
  ], [t, canEdit, navigate, i18n.language]);

  return (
    <DashboardLayout>
      <DataTable
        columns={columns}
        data={categories}
        loading={loading}
        pageSize={PAGE_SIZE}
        defaultSortKey="avgPoints"
        defaultSortDir="desc"
        title={t('categories.title')}
        emptyIcon={<FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto" />}
        emptyMessage={t('categories.noCategories')}
        emptyAction={canEdit ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('categories.addCategory')}</Button> : undefined}
        headerActions={canEdit ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('categories.addCategory')}</Button> : undefined}
        filters={[
          {
            key: 'is_default',
            label: t('filters.type'),
            allLabel: t('categories.allCategories'),
            options: [
              { value: 'true', label: t('categories.defaultType') },
              { value: 'false', label: t('categories.customType') },
            ],
          },
        ]}
        serverSide
        totalCount={totalCount}
        onServerChange={handleServerChange}
        onRowClick={(r) => navigate(`/dashboard/categories/${r.id}`)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t('common.edit') : t('categories.addCategory')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('categories.categoryName')}</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder={t('categories.categoryNamePlaceholder')} />
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="is-default" checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} />
              <Label htmlFor="is-default">{t('categoriesTable.isDefault')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !catName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('categories.deleteConfirm')}</AlertDialogDescription>
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
