import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DataTable, Column, FilterConfig } from '@/components/DataTable';
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

interface CategoryRow {
  id: string;
  name: string;
  organization_id: string;
  is_deleted: boolean;
  is_default: boolean;
  created_at: string;
  avgPoints: number | null;
}

export default function CategoriesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();

  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [catName, setCatName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<CategoryRow | null>(null);

  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const fetchCategories = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data: catData } = await supabase
      .from('categories')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .eq('is_deleted', false)
      .order('name') as { data: any[] | null };

    const cats = catData || [];

    if (cats.length > 0) {
      const catIds = cats.map((c) => c.id);

      // Get quiz_categories for these categories
      const { data: qcData } = await supabase
        .from('quiz_categories')
        .select('id, category_id, quiz_id')
        .in('category_id', catIds);

      const qcList = qcData || [];
      const qcIds = qcList.map((qc: any) => qc.id);

      // Get finished quiz IDs
      const qcQuizIds = [...new Set(qcList.map((qc: any) => qc.quiz_id))];
      let finishedQuizIds = new Set<string>();
      if (qcQuizIds.length > 0) {
        const { data: quizData } = await supabase
          .from('quizzes')
          .select('id')
          .in('id', qcQuizIds)
          .eq('status', 'finished');
        finishedQuizIds = new Set((quizData || []).map((q: any) => q.id));
      }

      // Filter qcList to only finished quizzes
      const finishedQcIds = new Set(qcList.filter((qc: any) => finishedQuizIds.has(qc.quiz_id)).map((qc: any) => qc.id));

      // Get scores for these quiz_categories
      let scoreMap = new Map<string, { total: number; count: number }>();
      if (qcIds.length > 0) {
        const { data: scoreData } = await supabase
          .from('scores')
          .select('quiz_category_id, points')
          .in('quiz_category_id', qcIds);

        // Map quiz_category_id -> category_id
        const qcToCat = new Map<string, string>();
        qcList.forEach((qc: any) => qcToCat.set(qc.id, qc.category_id));

        (scoreData || []).forEach((s: any) => {
          if (!finishedQcIds.has(s.quiz_category_id)) return;
          const catId = qcToCat.get(s.quiz_category_id);
          if (!catId) return;
          const agg = scoreMap.get(catId) || { total: 0, count: 0 };
          agg.total += Number(s.points || 0);
          agg.count++;
          scoreMap.set(catId, agg);
        });
      }

      setCategories(cats.map((c) => {
        const agg = scoreMap.get(c.id);
        return {
          ...c,
          avgPoints: agg && agg.count > 0 ? Math.round((agg.total / agg.count) * 10) / 10 : null,
        };
      }));
    } else {
      setCategories([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, [currentOrg?.id]);

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
    setSaving(false); setDialogOpen(false); fetchCategories();
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await supabase.from('categories').update({ is_deleted: true }).eq('id', deleteItem.id);
    toast({ title: '✓', description: t('categories.deleted') });
    setDeleteItem(null); fetchCategories();
  };

  const columns: Column<CategoryRow>[] = useMemo(() => [
    {
      key: 'name', label: t('categories.categoryName'), sortable: true,
      render: (r) => <p className="font-medium">{r.name}</p>,
      getValue: (r) => r.name,
    },
    {
      key: 'avgPoints', label: t('categoriesTable.avgPoints'), sortable: true,
      render: (r) => r.avgPoints != null ? r.avgPoints : '—',
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
          <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/categories/${r.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={() => setDeleteItem(r)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ], [t, canEdit, navigate]);

  return (
    <DashboardLayout>
      <DataTable
        columns={columns}
        data={categories}
        loading={loading}
        pageSize={15}
        defaultSortKey="name"
        defaultSortDir="asc"
        title={t('categories.title')}
        emptyIcon={<FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto" />}
        emptyMessage={t('categories.noCategories')}
        emptyAction={canEdit ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('categories.addCategory')}</Button> : undefined}
        headerActions={canEdit ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('categories.addCategory')}</Button> : undefined}
        searchFn={(row, q) => row.name.toLowerCase().includes(q)}
        filters={[
          {
            key: 'is_default',
            label: t('filters.type'),
            allLabel: t('filters.allTypes'),
            options: [
              { value: 'true', label: t('categoriesTable.default') },
              { value: 'false', label: t('filters.custom') },
            ],
          },
        ]}
        filterFn={(row, filters) => {
          if (filters.is_default && filters.is_default !== 'all') {
            return row.is_default === (filters.is_default === 'true');
          }
          return true;
        }}
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
