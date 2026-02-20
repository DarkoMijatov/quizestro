import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, FolderOpen, Loader2, Search } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  organization_id: string;
  is_deleted: boolean;
  created_at: string;
}

export default function CategoriesPage() {
  const { t } = useTranslation();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteItem, setDeleteItem] = useState<Category | null>(null);

  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const fetchCategories = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('organization_id', currentOrg.id)
      .eq('is_deleted', false)
      .order('name') as { data: Category[] | null };
    setCategories(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, [currentOrg?.id]);

  const openCreate = () => { setEditing(null); setCatName(''); setDialogOpen(true); };
  const openEdit = (cat: Category) => { setEditing(cat); setCatName(cat.name); setDialogOpen(true); };

  const handleSave = async () => {
    if (!currentOrg || !catName.trim()) return;
    setSaving(true);

    if (editing) {
      await supabase.from('categories').update({ name: catName.trim() }).eq('id', editing.id);
      toast({ title: '✓', description: t('categories.updated') });
    } else {
      await supabase.from('categories').insert({ name: catName.trim(), organization_id: currentOrg.id });
      toast({ title: '✓', description: t('categories.created') });
    }

    setSaving(false);
    setDialogOpen(false);
    fetchCategories();
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await supabase.from('categories').update({ is_deleted: true }).eq('id', deleteItem.id);
    toast({ title: '✓', description: t('categories.deleted') });
    setDeleteItem(null);
    fetchCategories();
  };

  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">{t('categories.title')}</h1>
          {canEdit && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('categories.addCategory')}
            </Button>
          )}
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{search ? t('common.noResults') : t('categories.noCategories')}</p>
            {!search && canEdit && (
              <Button onClick={openCreate} className="mt-4 gap-2"><Plus className="h-4 w-4" />{t('categories.addCategory')}</Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                  <p className="font-medium">{cat.name}</p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteItem(cat)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t('common.edit') : t('categories.addCategory')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('categories.categoryName')}</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder={t('categories.categoryNamePlaceholder')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !catName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('common.save')}
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
