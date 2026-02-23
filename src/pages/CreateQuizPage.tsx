import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { sr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  CalendarIcon, ArrowLeft, ArrowRight, Check, Loader2, Trophy, FolderOpen, Users, Upload, Download, FileSpreadsheet,
  Plus, GripVertical, X, Search,
} from 'lucide-react';
import { parseQuizExcel, generateImportTemplate } from '@/lib/excelUtils';
import { ImportExcelDialog } from '@/components/ImportExcelDialog';

interface Category { id: string; name: string; is_default?: boolean; }
interface Team { id: string; name: string; }
interface TeamAlias { id: string; alias: string; team_id: string; }
interface League { id: string; name: string; }

interface TeamSelection {
  teamId: string;
  alias: string;
}

const MANUAL_STEPS = ['step1', 'step2', 'step3', 'step4'] as const;

export default function CreateQuizPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg } = useOrganizations();
  const { user } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importQuizId, setImportQuizId] = useState<string | null>(null);

  // Step 1 — Details
  const [quizName, setQuizName] = useState('');
  const [quizDate, setQuizDate] = useState<Date>(new Date());
  const [location, setLocation] = useState('');
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);

  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamAliases, setTeamAliases] = useState<TeamAlias[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [helpTypes, setHelpTypes] = useState<{ id: string; name: string; effect: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Step 2 — Selected categories (ordered)
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [catSearch, setCatSearch] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  // Step 3 — Selected teams with aliases
  const [selectedTeams, setSelectedTeams] = useState<TeamSelection[]>([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [aliasMode, setAliasMode] = useState<string | null>(null); // search term for alias mode
  const [aliasTargetTeam, setAliasTargetTeam] = useState<string>('');

  // Drag state for reordering
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    const load = async () => {
      setLoadingData(true);
      const [catRes, teamRes, leagueRes, htRes, aliasRes] = await Promise.all([
        supabase.from('categories').select('id, name, is_default').eq('organization_id', currentOrg.id).eq('is_deleted', false).order('name'),
        supabase.from('teams').select('id, name').eq('organization_id', currentOrg.id).eq('is_deleted', false).order('name'),
        supabase.from('leagues').select('id, name').eq('organization_id', currentOrg.id).eq('is_active', true).order('name'),
        supabase.from('help_types').select('id, name, effect').eq('organization_id', currentOrg.id),
        supabase.from('team_aliases').select('id, alias, team_id').eq('organization_id', currentOrg.id),
      ]);
      const cats = (catRes.data as Category[]) || [];
      setCategories(cats);
      setTeams((teamRes.data as Team[]) || []);
      setTeamAliases((aliasRes.data as TeamAlias[]) || []);
      setLeagues((leagueRes.data as League[]) || []);
      setHelpTypes((htRes.data as any) || []);

      // Pre-select default categories
      const defaults = cats.filter(c => c.is_default).map(c => c.id);
      setSelectedCats(defaults);

      setLoadingData(false);
    };
    load();
  }, [currentOrg?.id]);

  const addCategory = (id: string) => {
    if (!selectedCats.includes(id)) setSelectedCats(prev => [...prev, id]);
  };
  const removeCategory = (id: string) => {
    setSelectedCats(prev => prev.filter(c => c !== id));
  };
  const moveCat = (from: number, to: number) => {
    setSelectedCats(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  const addTeam = (teamId: string) => {
    if (selectedTeams.find(t => t.teamId === teamId)) return;
    const team = teams.find(t => t.id === teamId);
    setSelectedTeams(prev => [...prev, { teamId, alias: team?.name || '' }]);
  };
  const removeTeam = (teamId: string) => {
    setSelectedTeams(prev => prev.filter(t => t.teamId !== teamId));
  };
  const updateTeamAlias = (teamId: string, alias: string) => {
    setSelectedTeams(prev => prev.map(t => t.teamId === teamId ? { ...t, alias } : t));
  };

  const canNext = () => {
    switch (step) {
      case 0: return true;
      case 1: return quizName.trim().length > 0;
      case 2: return selectedCats.length > 0;
      case 3: return selectedTeams.length >= 2;
      case 4: return true;
      default: return false;
    }
  };

  const handleCreateCategory = async () => {
    if (!currentOrg || !catSearch.trim()) return;
    setCreatingCat(true);
    const { data, error } = await supabase.from('categories').insert({ name: catSearch.trim(), organization_id: currentOrg.id }).select().single();
    if (data) {
      const newCat = data as Category;
      setCategories(prev => [...prev, newCat]);
      addCategory(newCat.id);
      setCatSearch('');
      toast({ title: '✓', description: t('quiz.categoryAdded') });
    }
    setCreatingCat(false);
  };

  const handleCreateTeam = async () => {
    if (!currentOrg || !teamSearch.trim()) return;
    setCreatingTeam(true);
    const { data } = await supabase.from('teams').insert({ name: teamSearch.trim(), organization_id: currentOrg.id }).select().single();
    if (data) {
      const newTeam = data as Team;
      setTeams(prev => [...prev, newTeam]);
      addTeam(newTeam.id);
      setTeamSearch('');
      toast({ title: '✓', description: t('quiz.teamAdded') });
    }
    setCreatingTeam(false);
  };

  const handleAddAlias = async () => {
    if (!currentOrg || !aliasMode || !aliasTargetTeam) return;
    setCreatingTeam(true);
    await supabase.from('team_aliases').insert({ alias: aliasMode, team_id: aliasTargetTeam, organization_id: currentOrg.id });
    setTeamAliases(prev => [...prev, { id: '', alias: aliasMode, team_id: aliasTargetTeam }]);
    addTeam(aliasTargetTeam);
    setAliasMode(null);
    setAliasTargetTeam('');
    setTeamSearch('');
    toast({ title: '✓', description: t('quiz.teamAdded') });
    setCreatingTeam(false);
  };

  const handleStartImport = async () => {
    if (!currentOrg || !user || !quizName.trim()) return;
    setCreating(true);
    const { data: quiz, error: quizErr } = await supabase
      .from('quizzes')
      .insert({
        name: quizName.trim(),
        date: format(quizDate, 'yyyy-MM-dd'),
        location: location.trim() || null,
        organization_id: currentOrg.id,
        league_id: selectedLeague || null,
        created_by: user.id,
        status: 'draft',
      })
      .select()
      .single();
    if (quizErr || !quiz) {
      toast({ title: 'Error', description: quizErr?.message || 'Failed to create quiz', variant: 'destructive' });
      setCreating(false);
      return;
    }
    setImportQuizId((quiz as any).id);
    setCreating(false);
    setImportDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!currentOrg || !user) return;
    setCreating(true);

    const { data: quiz, error: quizErr } = await supabase
      .from('quizzes')
      .insert({
        name: quizName.trim(),
        date: format(quizDate, 'yyyy-MM-dd'),
        location: location.trim() || null,
        organization_id: currentOrg.id,
        league_id: selectedLeague || null,
        created_by: user.id,
        status: 'draft',
      })
      .select()
      .single();

    if (quizErr || !quiz) {
      toast({ title: 'Error', description: quizErr?.message || 'Failed to create quiz', variant: 'destructive' });
      setCreating(false);
      return;
    }

    const quizId = (quiz as any).id;

    const catInserts = selectedCats.map((catId, i) => ({
      quiz_id: quizId,
      category_id: catId,
      organization_id: currentOrg.id,
      sort_order: i,
    }));
    const { data: insertedCats } = await supabase.from('quiz_categories').insert(catInserts).select();

    const teamInserts = selectedTeams.map(t => ({
      quiz_id: quizId,
      team_id: t.teamId,
      organization_id: currentOrg.id,
      alias: t.alias || null,
    }));
    const { data: insertedTeams } = await supabase.from('quiz_teams').insert(teamInserts).select();

    if (insertedCats && insertedTeams) {
      const scoreInserts: any[] = [];
      for (const qt of insertedTeams as any[]) {
        for (const qc of insertedCats as any[]) {
          scoreInserts.push({
            quiz_id: quizId,
            quiz_team_id: qt.id,
            quiz_category_id: qc.id,
            organization_id: currentOrg.id,
            points: 0,
            bonus_points: 0,
          });
        }
      }
      await supabase.from('scores').insert(scoreInserts);
    }

    toast({ title: '✓', description: t('quiz.created') });
    setCreating(false);
    navigate('/dashboard/quizzes');
  };

  const [mode, setMode] = useState<'choose' | 'manual' | 'import'>('choose');

  const formatDateLocale = (d: Date) => {
    return i18n.language === 'sr'
      ? format(d, 'dd. MMMM yyyy.', { locale: sr })
      : format(d, 'PPP');
  };

  // Filtered categories for left panel
  const availableCats = categories.filter(c => !selectedCats.includes(c.id));
  const filteredAvailableCats = catSearch.trim()
    ? availableCats.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()))
    : availableCats;
  const catSearchNoResults = catSearch.trim() && filteredAvailableCats.length === 0;

  // Filtered teams for left panel
  const availableTeams = teams.filter(t => !selectedTeams.find(s => s.teamId === t.id));
  const filteredAvailableTeams = teamSearch.trim()
    ? availableTeams.filter(t => {
        const q = teamSearch.toLowerCase();
        if (t.name.toLowerCase().includes(q)) return true;
        return teamAliases.some(a => a.team_id === t.id && a.alias.toLowerCase().includes(q));
      })
    : availableTeams;
  const teamSearchNoResults = teamSearch.trim() && filteredAvailableTeams.length === 0;

  if (loadingData) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/quizzes')} className="gap-1 mb-2">
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
          <h1 className="font-display text-2xl font-bold">{t('quiz.createTitle')}</h1>
        </div>

        {/* Step 0: Choose mode */}
        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('quiz.chooseMethod')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <button
                onClick={() => { setMode('manual'); setStep(1); }}
                className="rounded-xl border-2 border-border bg-card p-6 text-left hover:border-primary transition-colors space-y-3"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{t('quiz.manualCreate')}</h3>
                <p className="text-sm text-muted-foreground">{t('quiz.manualCreateDesc')}</p>
              </button>

              <button
                onClick={() => { setMode('import'); setStep(1); }}
                className="rounded-xl border-2 border-border bg-card p-6 text-left hover:border-primary transition-colors space-y-3"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">{t('quiz.importFromExcel')}</h3>
                <p className="text-sm text-muted-foreground">{t('quiz.importFromExcelDesc')}</p>
              </button>
            </div>

            <div className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => generateImportTemplate()} className="gap-2 text-muted-foreground">
                <Download className="h-4 w-4" />
                {t('quiz.downloadTemplate')}
              </Button>
            </div>
          </div>
        )}

        {/* Import mode */}
        {mode === 'import' && step === 1 && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t('quiz.importDetailsDesc')}</p>
            <div className="space-y-2">
              <Label>{t('quiz.name')}</Label>
              <Input value={quizName} onChange={(e) => setQuizName(e.target.value)} placeholder={t('quiz.namePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('quiz.date')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formatDateLocale(quizDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={quizDate} onSelect={(d) => d && setQuizDate(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>{t('quiz.location')}</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('quiz.locationPlaceholder')} />
            </div>
            {leagues.length > 0 && (
              <div className="space-y-2">
                <Label>{t('quiz.league')}</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={!selectedLeague} onCheckedChange={() => setSelectedLeague(null)} />
                    <span className="text-sm">{t('quiz.noLeague')}</span>
                  </label>
                  {leagues.map((l) => (
                    <label key={l.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedLeague === l.id} onCheckedChange={() => setSelectedLeague(l.id)} />
                      <span className="text-sm">{l.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => { setMode('choose'); setStep(0); }} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> {t('common.back')}
              </Button>
              <Button onClick={handleStartImport} disabled={!quizName.trim() || creating} className="gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {t('quiz.continueToImport')}
              </Button>
            </div>
          </div>
        )}

        {/* Manual mode */}
        {mode === 'manual' && step >= 1 && (
          <>
            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {MANUAL_STEPS.map((s, i) => {
                const stepIdx = i + 1;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <button
                      onClick={() => stepIdx < step && setStep(stepIdx)}
                      className={cn(
                        'flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-colors',
                        stepIdx < step ? 'bg-primary text-primary-foreground' :
                        stepIdx === step ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background' :
                        'bg-muted text-muted-foreground'
                      )}
                    >
                      {stepIdx < step ? <Check className="h-4 w-4" /> : i + 1}
                    </button>
                    <span className={cn('text-sm hidden sm:inline', stepIdx === step ? 'font-medium' : 'text-muted-foreground')}>
                      {t(`quiz.${s}`)}
                    </span>
                    {i < MANUAL_STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
                  </div>
                );
              })}
            </div>

            {/* Step content */}
            <div className="rounded-xl border border-border bg-card p-6">
              {/* STEP 1: Details */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('quiz.name')}</Label>
                    <Input value={quizName} onChange={(e) => setQuizName(e.target.value)} placeholder={t('quiz.namePlaceholder')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('quiz.date')}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formatDateLocale(quizDate)}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={quizDate} onSelect={(d) => d && setQuizDate(d)} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('quiz.location')}</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t('quiz.locationPlaceholder')} />
                  </div>
                  {leagues.length > 0 && (
                    <div className="space-y-2">
                      <Label>{t('quiz.league')}</Label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox checked={!selectedLeague} onCheckedChange={() => setSelectedLeague(null)} />
                          <span className="text-sm">{t('quiz.noLeague')}</span>
                        </label>
                        {leagues.map((l) => (
                          <label key={l.id} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox checked={selectedLeague === l.id} onCheckedChange={() => setSelectedLeague(l.id)} />
                            <span className="text-sm">{l.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Categories — Dual Panel */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">{t('quiz.selectCategories')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Available */}
                    <div className="border border-border rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground">{t('quiz.availableCategories')}</h4>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={catSearch}
                          onChange={e => setCatSearch(e.target.value)}
                          placeholder={t('quiz.searchCategories')}
                          className="pl-9 h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {filteredAvailableCats.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => addCategory(cat.id)}
                            className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left text-sm transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                            <FolderOpen className="h-3.5 w-3.5 text-primary" />
                            <span>{cat.name}</span>
                          </button>
                        ))}
                        {catSearchNoResults && (
                          <div className="py-4 text-center space-y-2">
                            <p className="text-xs text-muted-foreground">{t('quiz.createCategoryPrompt', { name: catSearch.trim() })}</p>
                            <Button size="sm" variant="outline" onClick={handleCreateCategory} disabled={creatingCat} className="gap-1">
                              {creatingCat ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                              {t('common.create')}
                            </Button>
                          </div>
                        )}
                        {!catSearch.trim() && availableCats.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">{t('common.noResults')}</p>
                        )}
                      </div>
                    </div>

                    {/* Right: Selected (ordered) */}
                    <div className="border border-border rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground">{t('quiz.selectedCategories')} ({selectedCats.length})</h4>
                      <div className="space-y-1 max-h-72 overflow-y-auto">
                        {selectedCats.map((id, idx) => {
                          const cat = categories.find(c => c.id === id);
                          return (
                            <div
                              key={id}
                              draggable
                              onDragStart={() => setDragIdx(idx)}
                              onDragOver={e => e.preventDefault()}
                              onDrop={() => { if (dragIdx !== null && dragIdx !== idx) moveCat(dragIdx, idx); setDragIdx(null); }}
                              className="flex items-center gap-2 p-2 rounded-md bg-primary/5 border border-primary/20 text-sm group"
                            >
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                              <FolderOpen className="h-3.5 w-3.5 text-primary" />
                              <span className="flex-1 font-medium">{cat?.name}</span>
                              <span className="text-xs text-muted-foreground mr-1">#{idx + 1}</span>
                              <button onClick={() => removeCategory(id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <X className="h-3.5 w-3.5 text-destructive" />
                              </button>
                            </div>
                          );
                        })}
                        {selectedCats.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-8">{t('quiz.minCategories')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Teams — Dual Panel */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">{t('quiz.selectTeams')}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Available */}
                    <div className="border border-border rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground">{t('quiz.availableTeams')}</h4>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={teamSearch}
                          onChange={e => { setTeamSearch(e.target.value); setAliasMode(null); }}
                          placeholder={t('quiz.searchTeams')}
                          className="pl-9 h-9 text-sm"
                        />
                      </div>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {filteredAvailableTeams.map(team => (
                          <button
                            key={team.id}
                            onClick={() => { addTeam(team.id); setTeamSearch(''); }}
                            className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent text-left text-sm transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                            <Users className="h-3.5 w-3.5 text-primary" />
                            <span>{team.name}</span>
                          </button>
                        ))}
                        {teamSearchNoResults && !aliasMode && (
                          <div className="py-4 text-center space-y-2">
                            <Button size="sm" variant="outline" onClick={handleCreateTeam} disabled={creatingTeam} className="gap-1 w-full">
                              {creatingTeam ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                              {t('quiz.createTeamPrompt', { name: teamSearch.trim() })}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setAliasMode(teamSearch.trim())} className="gap-1 w-full text-xs">
                              {t('quiz.addAliasPrompt', { name: teamSearch.trim() })}
                            </Button>
                          </div>
                        )}
                        {aliasMode && (
                          <div className="py-3 space-y-2 border-t border-border mt-2 pt-3">
                            <p className="text-xs text-muted-foreground">{t('quiz.selectTeamForAlias')}</p>
                            <Select value={aliasTargetTeam} onValueChange={setAliasTargetTeam}>
                              <SelectTrigger className="h-9 text-sm">
                                <SelectValue placeholder={t('quiz.selectTeamForAlias')} />
                              </SelectTrigger>
                              <SelectContent>
                                {teams.map(t => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setAliasMode(null)} className="flex-1">{t('common.cancel')}</Button>
                              <Button size="sm" onClick={handleAddAlias} disabled={!aliasTargetTeam || creatingTeam} className="flex-1">
                                {creatingTeam ? <Loader2 className="h-3 w-3 animate-spin" /> : t('common.confirm')}
                              </Button>
                            </div>
                          </div>
                        )}
                        {!teamSearch.trim() && availableTeams.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-4">{t('common.noResults')}</p>
                        )}
                      </div>
                    </div>

                    {/* Right: Selected */}
                    <div className="border border-border rounded-lg p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground">{t('quiz.selectedTeams')} ({selectedTeams.length})</h4>
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {selectedTeams.map(sel => {
                          const team = teams.find(t => t.id === sel.teamId);
                          return (
                            <div key={sel.teamId} className="p-2 rounded-md bg-primary/5 border border-primary/20 text-sm group space-y-1.5">
                              <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-primary" />
                                <span className="flex-1 font-medium">{team?.name}</span>
                                <button onClick={() => removeTeam(sel.teamId)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <X className="h-3.5 w-3.5 text-destructive" />
                                </button>
                              </div>
                              <Input
                                value={sel.alias}
                                onChange={e => updateTeamAlias(sel.teamId, e.target.value)}
                                placeholder={t('quiz.teamAlias')}
                                className="text-xs h-7"
                              />
                            </div>
                          );
                        })}
                        {selectedTeams.length === 0 && (
                          <p className="text-xs text-muted-foreground text-center py-8">{t('quiz.minTeams')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: Review */}
              {step === 4 && (
                <div className="space-y-6">
                  <h3 className="font-display text-lg font-semibold">{t('quiz.reviewTitle')}</h3>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('quiz.name')}</span>
                      <span className="font-medium">{quizName}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t('quiz.date')}</span>
                      <span className="font-medium">{formatDateLocale(quizDate)}</span>
                    </div>
                    {location && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t('quiz.location')}</span>
                        <span className="font-medium">{location}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2">{t('quiz.reviewCategories')} ({selectedCats.length})</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCats.map((id) => {
                        const cat = categories.find(c => c.id === id);
                        return (
                          <span key={id} className="inline-flex items-center gap-1 text-xs rounded-full bg-accent px-2.5 py-1 text-accent-foreground">
                            <FolderOpen className="h-3 w-3" />
                            {cat?.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold mb-2">{t('quiz.reviewTeams')} ({selectedTeams.length})</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTeams.map(sel => {
                        const team = teams.find(tm => tm.id === sel.teamId);
                        return (
                          <span key={sel.teamId} className="inline-flex items-center gap-1 text-xs rounded-full bg-accent px-2.5 py-1 text-accent-foreground">
                            <Users className="h-3 w-3" />
                            {sel.alias || team?.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Scoring table preview */}
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Scoring Table Preview</h4>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left p-2 font-medium">{t('teams.title')}</th>
                            {selectedCats.map(id => {
                              const cat = categories.find(c => c.id === id);
                              return <th key={id} className="text-center p-2 font-medium min-w-[80px]">{cat?.name}</th>;
                            })}
                            <th className="text-center p-2 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTeams.map(sel => {
                            const team = teams.find(tm => tm.id === sel.teamId);
                            return (
                              <tr key={sel.teamId} className="border-t border-border">
                                <td className="p-2 font-medium">{sel.alias || team?.name}</td>
                                {selectedCats.map(id => (
                                  <td key={id} className="text-center p-2 text-muted-foreground">0</td>
                                ))}
                                <td className="text-center p-2 font-semibold">0</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : (setMode('choose'), setStep(0))} className="gap-1">
                <ArrowLeft className="h-4 w-4" />
                {t('common.back')}
              </Button>

              {step < 4 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canNext()} className="gap-1">
                  {t('common.next')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleCreate} disabled={creating} className="gap-1">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                  {creating ? t('quiz.creating') : t('common.finish')}
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Import dialog */}
      {importQuizId && currentOrg && (
        <ImportExcelDialog
          open={importDialogOpen}
          onClose={() => {
            setImportDialogOpen(false);
            navigate(`/dashboard/quizzes/${importQuizId}`);
          }}
          quizId={importQuizId}
          organizationId={currentOrg.id}
          existingTeams={teams}
          existingCategories={categories}
          helpTypes={helpTypes}
          onImportComplete={() => {
            setImportDialogOpen(false);
            navigate(`/dashboard/quizzes/${importQuizId}`);
          }}
        />
      )}
    </DashboardLayout>
  );
}
