import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { DataTable, Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  BookOpen, Plus, Eye, Pencil, Trash2, Loader2, Upload, X,
  FileText, ListChecks, Link2, Image, Video, Music,
  HelpCircle, Hash, Check, ChevronsUpDown, Search, Download, FileSpreadsheet,
} from 'lucide-react';
import { generateQuestionImportTemplate, parseQuestionExcel, type ImportedQuestion, type QuestionImportResult } from '@/lib/excelUtils';

type QuestionType = 'text' | 'multiple_choice' | 'matching';
type MediaType = 'image' | 'video' | 'audio';
type MediaRole = 'supplementary' | 'key';

interface QuestionRow {
  id: string;
  code: string;
  question_text: string;
  type: QuestionType;
  media_url: string | null;
  media_type: MediaType | null;
  media_role: MediaRole | null;
  organization_id: string;
  is_deleted: boolean;
  created_at: string;
  categories: { id: string; name: string }[];
  quizzes: { id: string; name: string }[];
  used: boolean;
}

interface AnswerInput {
  id?: string;
  answer_text: string;
  is_correct: boolean;
}

interface MatchingPairInput {
  id?: string;
  left_value: string;
  right_value: string;
}

interface CategoryOption {
  id: string;
  name: string;
  code: string | null;
}

interface QuizOption {
  id: string;
  name: string;
  code: string | null;
}

export default function QuestionBankPage() {
  const { t } = useTranslation();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionRow | null>(null);
  const [viewing, setViewing] = useState<QuestionRow | null>(null);
  const [deleteItem, setDeleteItem] = useState<QuestionRow | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateQuestion, setDuplicateQuestion] = useState<QuestionRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formType, setFormType] = useState<QuestionType>('text');
  const [formText, setFormText] = useState('');
  const [formCategoryIds, setFormCategoryIds] = useState<string[]>([]);
  const [formQuizId, setFormQuizId] = useState<string>('');
  const [formAnswers, setFormAnswers] = useState<AnswerInput[]>([{ answer_text: '', is_correct: true }]);
  const [formPairs, setFormPairs] = useState<MatchingPairInput[]>([{ left_value: '', right_value: '' }]);
  const [formMediaFile, setFormMediaFile] = useState<File | null>(null);
  const [formMediaType, setFormMediaType] = useState<MediaType | null>(null);
  const [formMediaRole, setFormMediaRole] = useState<MediaRole | null>(null);
  const [formMediaUrl, setFormMediaUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<QuestionImportResult | null>(null);
  const [importingQuestions, setImportingQuestions] = useState(false);

  // View answers/pairs for viewing dialog
  const [viewAnswers, setViewAnswers] = useState<AnswerInput[]>([]);
  const [viewPairs, setViewPairs] = useState<MatchingPairInput[]>([]);

  const canEdit = currentRole === 'owner' || currentRole === 'admin';

  const fetchAll = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);

    const [{ data: qData }, { data: catData }, { data: quizData }] = await Promise.all([
      supabase.from('questions').select('*').eq('organization_id', currentOrg.id).eq('is_deleted', false).order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name, code').eq('organization_id', currentOrg.id).eq('is_deleted', false).order('name'),
      supabase.from('quizzes').select('id, name, code').eq('organization_id', currentOrg.id).order('date', { ascending: false }),
    ]);

    setCategories((catData as CategoryOption[]) || []);
    setQuizzes((quizData as QuizOption[]) || []);

    const rawQuestions = (qData || []) as any[];
    if (rawQuestions.length === 0) {
      setQuestions([]);
      setLoading(false);
      return;
    }

    const qIds = rawQuestions.map(q => q.id);

    const [{ data: qcData }, { data: qqData }] = await Promise.all([
      supabase.from('question_categories').select('question_id, category_id').in('question_id', qIds),
      supabase.from('quiz_questions').select('question_id, quiz_id, category_id').in('question_id', qIds),
    ]);

    const catMap = new Map((catData || []).map((c: any) => [c.id, c.name]));
    const quizMap = new Map((quizData || []).map((q: any) => [q.id, q.name]));

    const qcList = qcData || [];
    const qqList = qqData || [];

    const rows: QuestionRow[] = rawQuestions.map(q => {
      const qCats = qcList
        .filter((qc: any) => qc.question_id === q.id)
        .map((qc: any) => ({ id: qc.category_id, name: catMap.get(qc.category_id) || '?' }));
      const qQuizzes = [...new Map(
        qqList
          .filter((qq: any) => qq.question_id === q.id)
          .map((qq: any) => [qq.quiz_id, { id: qq.quiz_id, name: quizMap.get(qq.quiz_id) || '?' }])
      ).values()];

      return {
        ...q,
        categories: qCats,
        quizzes: qQuizzes,
        used: qQuizzes.length > 0,
      };
    });

    setQuestions(rows);
    setLoading(false);
  }, [currentOrg?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Stats
  const stats = useMemo(() => {
    const total = questions.length;
    const byType = { text: 0, multiple_choice: 0, matching: 0 };
    let unused = 0;
    let multiQuiz = 0;
    let multiCat = 0;
    questions.forEach(q => {
      byType[q.type]++;
      if (!q.used) unused++;
      if (q.quizzes.length > 1) multiQuiz++;
      if (q.categories.length > 1) multiCat++;
    });
    return { total, byType, unused, multiQuiz, multiCat };
  }, [questions]);

  const typeIcon = (type: QuestionType) => {
    switch (type) {
      case 'text': return <FileText className="h-4 w-4" />;
      case 'multiple_choice': return <ListChecks className="h-4 w-4" />;
      case 'matching': return <Link2 className="h-4 w-4" />;
    }
  };

  const typeLabel = (type: QuestionType) => t(`qb.type_${type}`);

  const generateCode = (catIds: string[], quizId: string | null) => {
    const cat = categories.find(c => catIds.includes(c.id));
    const catCode = cat?.code || cat?.name?.substring(0, 3).toUpperCase() || 'GEN';
    let quizCode = 'GEN';
    if (quizId) {
      const quiz = quizzes.find(q => q.id === quizId);
      quizCode = quiz?.code || quiz?.name?.substring(0, 3).toUpperCase() || 'GEN';
    }
    return { catCode, quizCode };
  };

  // Open create dialog
  const openCreate = () => {
    setEditing(null);
    setFormType('text');
    setFormText('');
    setFormCategoryIds([]);
    setFormQuizId('');
    setFormAnswers([{ answer_text: '', is_correct: true }]);
    setFormPairs([{ left_value: '', right_value: '' }]);
    setFormMediaFile(null);
    setFormMediaType(null);
    setFormMediaRole(null);
    setFormMediaUrl(null);
    setDialogOpen(true);
  };

  // Open edit dialog
  const openEdit = async (q: QuestionRow) => {
    setEditing(q);
    setFormType(q.type);
    setFormText(q.question_text);
    setFormCategoryIds(q.categories.map(c => c.id));
    setFormQuizId(q.quizzes[0]?.id || '');
    setFormMediaFile(null);
    setFormMediaType(q.media_type);
    setFormMediaRole((q as any).media_role || null);
    setFormMediaUrl(q.media_url);

    // Fetch answers/pairs
    if (q.type === 'text' || q.type === 'multiple_choice') {
      const { data } = await supabase.from('answers').select('*').eq('question_id', q.id).order('sort_order');
      setFormAnswers((data || []).map((a: any) => ({ id: a.id, answer_text: a.answer_text, is_correct: a.is_correct })));
      if (!data || data.length === 0) setFormAnswers([{ answer_text: '', is_correct: true }]);
    }
    if (q.type === 'matching') {
      const { data } = await supabase.from('matching_pairs').select('*').eq('question_id', q.id).order('sort_order');
      setFormPairs((data || []).map((p: any) => ({ id: p.id, left_value: p.left_value, right_value: p.right_value })));
      if (!data || data.length === 0) setFormPairs([{ left_value: '', right_value: '' }]);
    }

    setDialogOpen(true);
  };

  // Open view dialog
  const openView = async (q: QuestionRow) => {
    setViewing(q);
    if (q.type === 'text' || q.type === 'multiple_choice') {
      const { data } = await supabase.from('answers').select('*').eq('question_id', q.id).order('sort_order');
      setViewAnswers((data || []).map((a: any) => ({ answer_text: a.answer_text, is_correct: a.is_correct })));
    }
    if (q.type === 'matching') {
      const { data } = await supabase.from('matching_pairs').select('*').eq('question_id', q.id).order('sort_order');
      setViewPairs((data || []).map((p: any) => ({ left_value: p.left_value, right_value: p.right_value })));
    }
    setViewDialogOpen(true);
  };

  // Duplicate check
  const checkDuplicate = async (): Promise<QuestionRow | null> => {
    if (!currentOrg) return null;
    const trimmed = formText.trim().toLowerCase();
    if (!trimmed) return null;

    const existing = questions.find(q =>
      q.question_text.trim().toLowerCase() === trimmed &&
      (!editing || q.id !== editing.id)
    );
    return existing || null;
  };

  // Save question
  const handleSave = async (force = false) => {
    if (!currentOrg || !formText.trim() || formCategoryIds.length === 0) return;

    // Check duplicate
    if (!force && !editing) {
      const dup = await checkDuplicate();
      if (dup) {
        setDuplicateQuestion(dup);
        setDuplicateDialogOpen(true);
        return;
      }
    }

    setSaving(true);
    try {
      let mediaUrl = formMediaUrl;

      // Upload media if new file
      if (formMediaFile && formMediaType) {
        const ext = formMediaFile.name.split('.').pop();
        const path = `${currentOrg.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('question-media').upload(path, formMediaFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('question-media').getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
      }

      if (editing) {
        // Update question
        await supabase.from('questions').update({
          question_text: formText.trim(),
          type: formType,
          media_url: mediaUrl,
          media_type: formMediaType,
          media_role: formMediaRole,
        }).eq('id', editing.id);

        // Update categories - delete old, insert new
        await supabase.from('question_categories').delete().eq('question_id', editing.id);
        if (formCategoryIds.length > 0) {
          await supabase.from('question_categories').insert(
            formCategoryIds.map(cid => ({
              question_id: editing.id,
              category_id: cid,
              organization_id: currentOrg.id,
            }))
          );
        }

        // Update quiz link if changed
        const existingQuizIds = editing.quizzes.map(q => q.id);
        if (formQuizId && !existingQuizIds.includes(formQuizId)) {
          await supabase.from('quiz_questions').insert({
            quiz_id: formQuizId,
            question_id: editing.id,
            category_id: formCategoryIds[0],
            organization_id: currentOrg.id,
          });
        }

        // Update answers/pairs
        if (formType === 'text' || formType === 'multiple_choice') {
          await supabase.from('answers').delete().eq('question_id', editing.id);
          const validAnswers = formAnswers.filter(a => a.answer_text.trim());
          if (validAnswers.length > 0) {
            await supabase.from('answers').insert(
              validAnswers.map((a, i) => ({
                question_id: editing.id,
                answer_text: a.answer_text.trim(),
                is_correct: a.is_correct,
                sort_order: i,
                organization_id: currentOrg.id,
              }))
            );
          }
        }
        if (formType === 'matching') {
          await supabase.from('matching_pairs').delete().eq('question_id', editing.id);
          const validPairs = formPairs.filter(p => p.left_value.trim() && p.right_value.trim());
          if (validPairs.length > 0) {
            await supabase.from('matching_pairs').insert(
              validPairs.map((p, i) => ({
                question_id: editing.id,
                left_value: p.left_value.trim(),
                right_value: p.right_value.trim(),
                sort_order: i,
                organization_id: currentOrg.id,
              }))
            );
          }
        }

        toast({ title: '✓', description: t('qb.updated') });
      } else {
        // Generate code
        const { catCode, quizCode } = generateCode(formCategoryIds, formQuizId || null);
        const { data: seqData } = await supabase.rpc('next_question_id');
        const globalId = seqData || Date.now();
        const code = `${catCode}-${quizCode}-${globalId}`;

        // Insert question
        const { data: newQ, error: qErr } = await supabase.from('questions').insert({
          organization_id: currentOrg.id,
          code,
          question_text: formText.trim(),
          type: formType,
          media_url: mediaUrl,
          media_type: formMediaType,
          media_role: formMediaRole,
        }).select('id').single();

        if (qErr || !newQ) throw qErr;

        // Insert categories
        await supabase.from('question_categories').insert(
          formCategoryIds.map(cid => ({
            question_id: newQ.id,
            category_id: cid,
            organization_id: currentOrg.id,
          }))
        );

        // Insert quiz link
        if (formQuizId) {
          await supabase.from('quiz_questions').insert({
            quiz_id: formQuizId,
            question_id: newQ.id,
            category_id: formCategoryIds[0],
            organization_id: currentOrg.id,
          });
        }

        // Insert answers
        if (formType === 'text' || formType === 'multiple_choice') {
          const validAnswers = formAnswers.filter(a => a.answer_text.trim());
          if (validAnswers.length > 0) {
            await supabase.from('answers').insert(
              validAnswers.map((a, i) => ({
                question_id: newQ.id,
                answer_text: a.answer_text.trim(),
                is_correct: a.is_correct,
                sort_order: i,
                organization_id: currentOrg.id,
              }))
            );
          }
        }

        // Insert matching pairs
        if (formType === 'matching') {
          const validPairs = formPairs.filter(p => p.left_value.trim() && p.right_value.trim());
          if (validPairs.length > 0) {
            await supabase.from('matching_pairs').insert(
              validPairs.map((p, i) => ({
                question_id: newQ.id,
                left_value: p.left_value.trim(),
                right_value: p.right_value.trim(),
                sort_order: i,
                organization_id: currentOrg.id,
              }))
            );
          }
        }

        toast({ title: '✓', description: t('qb.created') });
      }

      setDialogOpen(false);
      setDuplicateDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast({ title: t('qb.error'), description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await supabase.from('questions').update({ is_deleted: true }).eq('id', deleteItem.id);
    toast({ title: '✓', description: t('qb.deleted') });
    setDeleteItem(null);
    fetchAll();
  };

  // Media handling
  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type;
    let mt: MediaType = 'image';
    if (mime.startsWith('video/')) mt = 'video';
    else if (mime.startsWith('audio/')) mt = 'audio';
    setFormMediaFile(file);
    setFormMediaType(mt);
    setFormMediaUrl(URL.createObjectURL(file));
  };

  const removeMedia = () => {
    setFormMediaFile(null);
    setFormMediaType(null);
    setFormMediaRole(null);
    setFormMediaUrl(null);
  };

  // Import handlers
  const handleImportFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const existingCatNames = categories.map(c => c.name);
      const result = await parseQuestionExcel(file, existingCatNames);
      setImportResult(result);
      setImportDialogOpen(true);
    } catch (err: any) {
      toast({ title: t('qb.importError'), description: err.message, variant: 'destructive' });
    }
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (!importResult || !currentOrg) return;
    setImportingQuestions(true);
    try {
      // 1. Create new categories
      const catMap = new Map<string, string>();
      for (const c of categories) catMap.set(c.name.toLowerCase(), c.id);

      for (const newCat of importResult.newCategories) {
        const { data } = await supabase.from('categories').insert({
          name: newCat, organization_id: currentOrg.id,
        }).select('id').single();
        if (data) catMap.set(newCat.toLowerCase(), data.id);
      }

      // 2. Import each question
      for (const q of importResult.questions) {
        const catId = catMap.get(q.categoryName.toLowerCase());
        if (!catId) continue;

        const catObj = categories.find(c => c.id === catId);
        const catCode = catObj?.code || catObj?.name?.substring(0, 3).toUpperCase() || 'GEN';
        const { data: seqData } = await supabase.rpc('next_question_id');
        const globalId = seqData || Date.now();
        const code = `${catCode}-GEN-${globalId}`;

        const { data: newQ, error: qErr } = await supabase.from('questions').insert({
          organization_id: currentOrg.id,
          code,
          question_text: q.questionText,
          type: q.type,
        }).select('id').single();

        if (qErr || !newQ) continue;

        // Link category
        await supabase.from('question_categories').insert({
          question_id: newQ.id,
          category_id: catId,
          organization_id: currentOrg.id,
        });

        // Insert answers
        if ((q.type === 'text' || q.type === 'multiple_choice') && q.answers.length > 0) {
          await supabase.from('answers').insert(
            q.answers.map((a, i) => ({
              question_id: newQ.id,
              answer_text: a.text,
              is_correct: a.isCorrect,
              sort_order: i,
              organization_id: currentOrg.id,
            }))
          );
        }

        // Insert matching pairs
        if (q.type === 'matching' && q.pairs.length > 0) {
          await supabase.from('matching_pairs').insert(
            q.pairs.map((p, i) => ({
              question_id: newQ.id,
              left_value: p.left,
              right_value: p.right,
              sort_order: i,
              organization_id: currentOrg.id,
            }))
          );
        }
      }

      toast({ title: '✓', description: t('qb.importSuccess') });
      setImportDialogOpen(false);
      setImportResult(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: t('qb.importError'), description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setImportingQuestions(false);
    }
  };

  const addAnswer = () => setFormAnswers([...formAnswers, { answer_text: '', is_correct: false }]);
  const removeAnswer = (idx: number) => setFormAnswers(formAnswers.filter((_, i) => i !== idx));
  const updateAnswer = (idx: number, field: keyof AnswerInput, value: any) => {
    const updated = [...formAnswers];
    if (field === 'is_correct' && formType === 'multiple_choice') {
      updated.forEach((a, i) => { a.is_correct = i === idx; });
    } else {
      (updated[idx] as any)[field] = value;
    }
    setFormAnswers(updated);
  };

  // Pair helpers
  const addPair = () => setFormPairs([...formPairs, { left_value: '', right_value: '' }]);
  const removePair = (idx: number) => setFormPairs(formPairs.filter((_, i) => i !== idx));
  const updatePair = (idx: number, field: 'left_value' | 'right_value', value: string) => {
    const updated = [...formPairs];
    updated[idx][field] = value;
    setFormPairs(updated);
  };

  const columns: Column<QuestionRow>[] = useMemo(() => [
    {
      key: 'code', label: t('qb.code'), sortable: true,
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.code}</span>,
      getValue: (r) => r.code,
    },
    {
      key: 'type', label: t('qb.typeCol'), sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {typeIcon(r.type)}
          <span className="text-xs">{typeLabel(r.type)}</span>
        </div>
      ),
      getValue: (r) => r.type,
    },
    {
      key: 'question_text', label: t('qb.questionText'), sortable: true,
      render: (r) => (
        <div className="max-w-[300px] truncate">
          {r.media_type && (
            <span className="mr-1.5 inline-flex">
              {r.media_type === 'image' ? <Image className="h-3.5 w-3.5 text-muted-foreground" /> :
               r.media_type === 'video' ? <Video className="h-3.5 w-3.5 text-muted-foreground" /> :
               <Music className="h-3.5 w-3.5 text-muted-foreground" />}
            </span>
          )}
          {r.question_text}
        </div>
      ),
      getValue: (r) => r.question_text,
    },
    {
      key: 'categories', label: t('qb.categoriesCol'),
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.categories.map(c => (
            <Badge key={c.id} variant="secondary" className="text-[10px]">{c.name}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'quizzes', label: t('qb.quizzesCol'),
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.quizzes.map(q => (
            <Badge key={q.id} variant="outline" className="text-[10px]">{q.name}</Badge>
          ))}
          {r.quizzes.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
        </div>
      ),
    },
    {
      key: 'used', label: t('qb.usedCol'), sortable: true,
      render: (r) => r.used
        ? <Badge variant="default" className="text-[10px]">{t('qb.yes')}</Badge>
        : <span className="text-xs text-muted-foreground">{t('qb.no')}</span>,
      getValue: (r) => r.used ? 1 : 0,
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => openView(r)}>
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('common.details')}</TooltipContent>
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
          {currentRole === 'owner' && (
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
  ], [t, canEdit, currentRole, categories, quizzes, questions]);

  const isFormValid = formText.trim() && formCategoryIds.length > 0 && (
    formType === 'text' ? formAnswers.some(a => a.answer_text.trim()) :
    formType === 'multiple_choice' ? formAnswers.filter(a => a.answer_text.trim()).length >= 2 && formAnswers.some(a => a.is_correct && a.answer_text.trim()) :
    formPairs.filter(p => p.left_value.trim() && p.right_value.trim()).length >= 2
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Hash className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">{t('qb.statTotal')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{stats.byType.text}</p>
              <p className="text-xs text-muted-foreground">{t('qb.statText')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <ListChecks className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{stats.byType.multiple_choice}</p>
              <p className="text-xs text-muted-foreground">{t('qb.statMC')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Link2 className="h-5 w-5 mx-auto text-primary mb-1" />
              <p className="text-2xl font-bold">{stats.byType.matching}</p>
              <p className="text-xs text-muted-foreground">{t('qb.statMatching')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <HelpCircle className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold">{stats.unused}</p>
              <p className="text-xs text-muted-foreground">{t('qb.statUnused')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Data table */}
        <DataTable
          columns={columns}
          data={questions}
          loading={loading}
          pageSize={15}
          defaultSortKey="created_at"
          defaultSortDir="desc"
          title={t('qb.title')}
          emptyIcon={<BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto" />}
          emptyMessage={t('qb.empty')}
          emptyAction={canEdit ? <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('qb.add')}</Button> : undefined}
          headerActions={canEdit ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => generateQuestionImportTemplate()} className="gap-2">
                <Download className="h-4 w-4" />{t('qb.downloadTemplate')}
              </Button>
              <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFileSelect} />
              <Button variant="outline" size="sm" onClick={() => importFileRef.current?.click()} className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />{t('qb.importQuestions')}
              </Button>
              <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" />{t('qb.add')}</Button>
            </div>
          ) : undefined}
          searchFn={(row, q) => row.code.toLowerCase().includes(q) || row.question_text.toLowerCase().includes(q)}
          filters={[
            {
              key: 'type',
              label: t('qb.filterType'),
              allLabel: t('filters.allTypes'),
              options: [
                { value: 'text', label: t('qb.type_text') },
                { value: 'multiple_choice', label: t('qb.type_multiple_choice') },
                { value: 'matching', label: t('qb.type_matching') },
              ],
            },
            {
              key: 'category',
              label: t('qb.filterCategory'),
              allLabel: t('qb.allCategories'),
              searchable: true,
              options: categories.map(c => ({ value: c.id, label: c.name })),
            },
            {
              key: 'quiz',
              label: t('qb.filterQuiz'),
              allLabel: t('qb.allQuizzes'),
              searchable: true,
              options: quizzes.map(q => ({ value: q.id, label: q.name })),
            },
            {
              key: 'used',
              label: t('qb.filterUsed'),
              allLabel: t('qb.allQuestions'),
              options: [
                { value: 'yes', label: t('qb.usedOnly') },
                { value: 'no', label: t('qb.unusedOnly') },
              ],
            },
          ]}
          filterFn={(row, filters) => {
            if (filters.type && filters.type !== 'all' && row.type !== filters.type) return false;
            if (filters.category && filters.category !== 'all' && !row.categories.some(c => c.id === filters.category)) return false;
            if (filters.quiz && filters.quiz !== 'all' && !row.quizzes.some(q => q.id === filters.quiz)) return false;
            if (filters.used === 'yes' && !row.used) return false;
            if (filters.used === 'no' && row.used) return false;
            return true;
          }}
        />
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('qb.editTitle') : t('qb.addTitle')}</DialogTitle>
            <DialogDescription>{editing ? t('qb.editDesc') : t('qb.addDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Question type */}
            <div className="space-y-2">
              <Label>{t('qb.typeCol')}</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as QuestionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">{t('qb.type_text')}</SelectItem>
                  <SelectItem value="multiple_choice">{t('qb.type_multiple_choice')}</SelectItem>
                  <SelectItem value="matching">{t('qb.type_matching')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Categories (searchable multi-select) */}
            <div className="space-y-2">
              <Label>{t('qb.categoriesCol')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {formCategoryIds.length > 0
                      ? formCategoryIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean).join(', ')
                      : t('qb.noCategories')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('qb.searchCategories')} />
                    <CommandList>
                      <CommandEmpty>{t('qb.noCategories')}</CommandEmpty>
                      <CommandGroup>
                        {categories.map(cat => (
                          <CommandItem
                            key={cat.id}
                            value={cat.name}
                            onSelect={() => {
                              if (formCategoryIds.includes(cat.id)) {
                                setFormCategoryIds(formCategoryIds.filter(id => id !== cat.id));
                              } else {
                                setFormCategoryIds([...formCategoryIds, cat.id]);
                              }
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${formCategoryIds.includes(cat.id) ? 'opacity-100' : 'opacity-0'}`} />
                            {cat.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Quiz (searchable select) */}
            <div className="space-y-2">
              <Label>{t('qb.quizOptional')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {formQuizId ? quizzes.find(q => q.id === formQuizId)?.name || t('qb.noQuiz') : t('qb.noQuiz')}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('qb.searchQuizzes')} />
                    <CommandList>
                      <CommandEmpty>{t('common.noResults')}</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="__none__" onSelect={() => setFormQuizId('')}>
                          <Check className={`mr-2 h-4 w-4 ${!formQuizId ? 'opacity-100' : 'opacity-0'}`} />
                          {t('qb.noQuiz')}
                        </CommandItem>
                        {quizzes.map(q => (
                          <CommandItem
                            key={q.id}
                            value={q.name}
                            onSelect={() => setFormQuizId(q.id)}
                          >
                            <Check className={`mr-2 h-4 w-4 ${formQuizId === q.id ? 'opacity-100' : 'opacity-0'}`} />
                            {q.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Question text */}
            <div className="space-y-2">
              <Label>{t('qb.questionText')}</Label>
              <Textarea
                value={formText}
                onChange={(e) => setFormText(e.target.value)}
                placeholder={t('qb.questionPlaceholder')}
                rows={3}
              />
            </div>

            {/* Media */}
            <div className="space-y-2">
              <Label>{t('qb.media')}</Label>
              {formMediaUrl ? (
                <div className="flex items-center gap-3 p-3 border border-border rounded-md">
                  {formMediaType === 'image' && <img src={formMediaUrl} alt="" className="h-16 w-16 object-cover rounded" />}
                  {formMediaType === 'video' && <Video className="h-8 w-8 text-muted-foreground" />}
                  {formMediaType === 'audio' && <Music className="h-8 w-8 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground flex-1 truncate">{formMediaFile?.name || formMediaUrl}</span>
                  <Button variant="ghost" size="icon" onClick={removeMedia}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*" className="hidden" onChange={handleMediaSelect} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                    <Upload className="h-4 w-4" />{t('qb.uploadMedia')}
                  </Button>
                </div>
              )}
            </div>

            {/* Media Role */}
            {formMediaUrl && (
              <div className="space-y-2">
                <Label>{t('qb.mediaRole')}</Label>
                <Select value={formMediaRole || ''} onValueChange={(v) => setFormMediaRole(v as MediaRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('qb.selectMediaRole')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplementary">{t('qb.mediaRoleSupplementary')}</SelectItem>
                    <SelectItem value="key">{t('qb.mediaRoleKey')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formMediaRole === 'key' ? t('qb.mediaRoleKeyHint') : t('qb.mediaRoleSupplementaryHint')}
                </p>
              </div>
            )}

            {(formType === 'text' || formType === 'multiple_choice') && (
              <div className="space-y-2">
                <Label>{formType === 'text' ? t('qb.correctAnswer') : t('qb.answers')}</Label>
                <div className="space-y-2">
                  {formAnswers.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {formType === 'multiple_choice' && (
                        <Checkbox
                          checked={a.is_correct}
                          onCheckedChange={() => updateAnswer(i, 'is_correct', true)}
                        />
                      )}
                      <Input
                        value={a.answer_text}
                        onChange={(e) => updateAnswer(i, 'answer_text', e.target.value)}
                        placeholder={formType === 'text' ? t('qb.answerPlaceholder') : `${t('qb.option')} ${i + 1}`}
                        className="flex-1"
                      />
                      {formType === 'multiple_choice' && formAnswers.length > 2 && (
                        <Button variant="ghost" size="icon" onClick={() => removeAnswer(i)}><X className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                </div>
                {formType === 'multiple_choice' && (
                  <Button variant="outline" size="sm" onClick={addAnswer} className="gap-2"><Plus className="h-3 w-3" />{t('qb.addOption')}</Button>
                )}
              </div>
            )}

            {/* Matching pairs */}
            {formType === 'matching' && (
              <div className="space-y-2">
                <Label>{t('qb.matchingPairs')}</Label>
                <div className="space-y-2">
                  {formPairs.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={p.left_value}
                        onChange={(e) => updatePair(i, 'left_value', e.target.value)}
                        placeholder={`${t('qb.left')} ${i + 1}`}
                        className="flex-1"
                      />
                      <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        value={p.right_value}
                        onChange={(e) => updatePair(i, 'right_value', e.target.value)}
                        placeholder={`${t('qb.right')} ${i + 1}`}
                        className="flex-1"
                      />
                      {formPairs.length > 2 && (
                        <Button variant="ghost" size="icon" onClick={() => removePair(i)}><X className="h-4 w-4" /></Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addPair} className="gap-2"><Plus className="h-3 w-3" />{t('qb.addPair')}</Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => handleSave(false)} disabled={saving || !isFormValid}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewing?.code}</DialogTitle>
            <DialogDescription>{typeLabel(viewing?.type || 'text')}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <p className="text-sm">{viewing.question_text}</p>

              {viewing.media_url && (
                <div className="rounded-md border border-border p-3">
                  {viewing.media_type === 'image' && <img src={viewing.media_url} alt="" className="max-h-48 rounded object-contain mx-auto" />}
                  {viewing.media_type === 'video' && <video src={viewing.media_url} controls className="max-h-48 rounded mx-auto" />}
                  {viewing.media_type === 'audio' && <audio src={viewing.media_url} controls className="w-full" />}
                </div>
              )}

              {(viewing.type === 'text' || viewing.type === 'multiple_choice') && viewAnswers.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('qb.answers')}</Label>
                  {viewAnswers.map((a, i) => (
                    <div key={i} className={`text-sm px-3 py-1.5 rounded ${a.is_correct ? 'bg-primary/10 text-primary font-medium' : ''}`}>
                      {viewing.type === 'multiple_choice' && <span className="mr-2">{String.fromCharCode(65 + i)}.</span>}
                      {a.answer_text}
                      {a.is_correct && <span className="ml-2">✓</span>}
                    </div>
                  ))}
                </div>
              )}

              {viewing.type === 'matching' && viewPairs.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t('qb.matchingPairs')}</Label>
                  {viewPairs.map((p, i) => (
                    <div key={i} className="text-sm flex items-center gap-2 px-3 py-1.5">
                      <span className="font-medium">{p.left_value}</span>
                      <span className="text-muted-foreground">→</span>
                      <span>{p.right_value}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                <Label className="text-xs text-muted-foreground w-full mb-1">{t('qb.categoriesCol')}</Label>
                {viewing.categories.map(c => <Badge key={c.id} variant="secondary" className="text-xs">{c.name}</Badge>)}
              </div>

              {viewing.quizzes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <Label className="text-xs text-muted-foreground w-full mb-1">{t('qb.quizzesCol')}</Label>
                  {viewing.quizzes.map(q => <Badge key={q.id} variant="outline" className="text-xs">{q.name}</Badge>)}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate check dialog */}
      <AlertDialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('qb.duplicateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('qb.duplicateDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          {duplicateQuestion && (
            <div className="border border-border rounded-md p-3 space-y-2">
              <p className="text-sm font-medium">{duplicateQuestion.code}</p>
              <p className="text-sm">{duplicateQuestion.question_text}</p>
              {duplicateQuestion.quizzes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground">{t('qb.usedIn')}:</span>
                  {duplicateQuestion.quizzes.map(q => <Badge key={q.id} variant="outline" className="text-[10px]">{q.name}</Badge>)}
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleSave(true)}>{t('qb.addAnyway')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('qb.deleteConfirm')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(o) => { if (!o) { setImportDialogOpen(false); setImportResult(null); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('qb.importTitle')}</DialogTitle>
            <DialogDescription>{t('qb.importDesc')}</DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                {importResult.questions.length} {t('qb.questionsToImport')}
              </div>

              <div className="flex flex-wrap gap-2">
                {(['text', 'multiple_choice', 'matching'] as const).map(type => {
                  const count = importResult.questions.filter(q => q.type === type).length;
                  if (count === 0) return null;
                  return (
                    <div key={type} className="flex items-center gap-1.5 text-sm border border-border rounded-md px-3 py-2">
                      {type === 'text' ? <FileText className="h-3.5 w-3.5 text-primary" /> :
                       type === 'multiple_choice' ? <ListChecks className="h-3.5 w-3.5 text-primary" /> :
                       <Link2 className="h-3.5 w-3.5 text-primary" />}
                      <span>{count} {t(`qb.type_${type}`)}</span>
                    </div>
                  );
                })}
              </div>

              {importResult.newCategories.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-primary">{t('qb.newCategoriesWillCreate')}</p>
                  <div className="flex flex-wrap gap-1">
                    {importResult.newCategories.map(c => (
                      <Badge key={c} variant="secondary">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="border border-border rounded-md max-h-48 overflow-y-auto">
                {importResult.questions.slice(0, 20).map((q, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm border-b border-border last:border-0">
                    {q.type === 'text' ? <FileText className="h-3 w-3 text-muted-foreground shrink-0" /> :
                     q.type === 'multiple_choice' ? <ListChecks className="h-3 w-3 text-muted-foreground shrink-0" /> :
                     <Link2 className="h-3 w-3 text-muted-foreground shrink-0" />}
                    <span className="truncate flex-1">{q.questionText}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{q.categoryName}</Badge>
                  </div>
                ))}
                {importResult.questions.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    +{importResult.questions.length - 20} ...
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportResult(null); }}>
                  {t('common.cancel')}
                </Button>
                <Button onClick={handleConfirmImport} disabled={importingQuestions}>
                  {importingQuestions && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {importingQuestions ? t('qb.importing') : t('qb.confirmImport')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
