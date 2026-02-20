import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
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
import { cn } from '@/lib/utils';
import {
  CalendarIcon, ArrowLeft, ArrowRight, Check, Loader2, Trophy, FolderOpen, Users, Upload, Download, FileSpreadsheet,
} from 'lucide-react';
import { parseQuizExcel, generateImportTemplate } from '@/lib/excelUtils';
import { ImportExcelDialog } from '@/components/ImportExcelDialog';

interface Category { id: string; name: string; }
interface Team { id: string; name: string; }
interface League { id: string; name: string; }

interface TeamSelection {
  teamId: string;
  alias: string;
}

const STEPS = ['step0', 'step1', 'step2', 'step3', 'step4'] as const;

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
  const [leagues, setLeagues] = useState<League[]>([]);
  const [helpTypes, setHelpTypes] = useState<{ id: string; name: string; effect: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Step 2 — Selected categories
  const [selectedCats, setSelectedCats] = useState<string[]>([]);

  // Step 3 — Selected teams with aliases
  const [selectedTeams, setSelectedTeams] = useState<TeamSelection[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    const load = async () => {
      setLoadingData(true);
      const [catRes, teamRes, leagueRes, htRes] = await Promise.all([
        supabase.from('categories').select('id, name').eq('organization_id', currentOrg.id).eq('is_deleted', false).order('name'),
        supabase.from('teams').select('id, name').eq('organization_id', currentOrg.id).eq('is_deleted', false).order('name'),
        supabase.from('leagues').select('id, name').eq('organization_id', currentOrg.id).eq('is_active', true).order('name'),
        supabase.from('help_types').select('id, name, effect').eq('organization_id', currentOrg.id),
      ]);
      setCategories((catRes.data as Category[]) || []);
      setTeams((teamRes.data as Team[]) || []);
      setLeagues((leagueRes.data as League[]) || []);
      setHelpTypes((htRes.data as any) || []);
      setLoadingData(false);
    };
    load();
  }, [currentOrg?.id]);

  const toggleCategory = (id: string) => {
    setSelectedCats((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeams((prev) => {
      if (prev.find((t) => t.teamId === teamId)) {
        return prev.filter((t) => t.teamId !== teamId);
      }
      const team = teams.find((t) => t.id === teamId);
      return [...prev, { teamId, alias: team?.name || '' }];
    });
  };

  const updateTeamAlias = (teamId: string, alias: string) => {
    setSelectedTeams((prev) => prev.map((t) => t.teamId === teamId ? { ...t, alias } : t));
  };

  const canNext = () => {
    switch (step) {
      case 0: return true; // choice step
      case 1: return quizName.trim().length > 0;
      case 2: return selectedCats.length > 0;
      case 3: return selectedTeams.length >= 2;
      case 4: return true;
      default: return false;
    }
  };

  // For import flow: create a quiz shell first, then open import dialog
  const handleImportFlow = async () => {
    if (!currentOrg || !user) return;
    // We need a quiz name first — go to details step, but with import flag
    setStep(1);
  };

  const handleStartImport = async () => {
    if (!currentOrg || !user || !quizName.trim()) return;
    setCreating(true);

    // Create a draft quiz
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

    // 1. Create quiz
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

    // 2. Insert quiz_categories
    const catInserts = selectedCats.map((catId, i) => ({
      quiz_id: quizId,
      category_id: catId,
      organization_id: currentOrg.id,
      sort_order: i,
    }));
    const { data: insertedCats } = await supabase.from('quiz_categories').insert(catInserts).select();

    // 3. Insert quiz_teams
    const teamInserts = selectedTeams.map((t) => ({
      quiz_id: quizId,
      team_id: t.teamId,
      organization_id: currentOrg.id,
      alias: t.alias || null,
    }));
    const { data: insertedTeams } = await supabase.from('quiz_teams').insert(teamInserts).select();

    // 4. Generate scoring table (scores for each team × category)
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

  // Track whether user chose import path
  const [mode, setMode] = useState<'choose' | 'manual' | 'import'>('choose');

  if (loadingData) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  const manualStepIndex = mode === 'manual' ? step - 1 : step - 1; // step 0 = choose, steps 1-4 for manual
  const MANUAL_STEPS = ['step1', 'step2', 'step3', 'step4'] as const;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-8">
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

        {/* Import mode: Details then import dialog */}
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
                  <Button variant="outline" className={cn('w-full justify-start text-left font-normal')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(quizDate, 'PPP')}
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

        {/* Manual mode: original wizard steps */}
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
                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal')}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(quizDate, 'PPP')}
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

              {/* STEP 2: Categories */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">{t('quiz.selectCategories')}</p>
                  {categories.length === 0 ? (
                    <div className="text-center py-8">
                      <FolderOpen className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">{t('quiz.noCategoriesToSelect')}</p>
                      <Button variant="outline" className="mt-3" onClick={() => navigate('/dashboard/categories')}>
                        {t('categories.addCategory')}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {categories.map((cat) => (
                        <label
                          key={cat.id}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                            selectedCats.includes(cat.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                          )}
                        >
                          <Checkbox checked={selectedCats.includes(cat.id)} onCheckedChange={() => toggleCategory(cat.id)} />
                          <FolderOpen className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{cat.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Teams */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">{t('quiz.selectTeams')}</p>
                  {teams.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">{t('quiz.noTeamsToSelect')}</p>
                      <Button variant="outline" className="mt-3" onClick={() => navigate('/dashboard/teams')}>
                        {t('teams.addTeam')}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {teams.map((team) => {
                        const selected = selectedTeams.find((t) => t.teamId === team.id);
                        return (
                          <div
                            key={team.id}
                            className={cn(
                              'rounded-lg border p-3 transition-colors',
                              selected ? 'border-primary bg-primary/5' : 'border-border'
                            )}
                          >
                            <label className="flex items-center gap-3 cursor-pointer">
                              <Checkbox checked={!!selected} onCheckedChange={() => toggleTeam(team.id)} />
                              <Users className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">{team.name}</span>
                            </label>
                            {selected && (
                              <div className="mt-2 ml-9">
                                <Input
                                  value={selected.alias}
                                  onChange={(e) => updateTeamAlias(team.id, e.target.value)}
                                  placeholder={t('quiz.teamAlias')}
                                  className="text-sm h-8"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
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
                      <span className="font-medium">{format(quizDate, 'PPP')}</span>
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
                        const cat = categories.find((c) => c.id === id);
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
                      {selectedTeams.map((t) => {
                        const team = teams.find((tm) => tm.id === t.teamId);
                        return (
                          <span key={t.teamId} className="inline-flex items-center gap-1 text-xs rounded-full bg-accent px-2.5 py-1 text-accent-foreground">
                            <Users className="h-3 w-3" />
                            {t.alias || team?.name}
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
                            {selectedCats.map((id) => {
                              const cat = categories.find((c) => c.id === id);
                              return <th key={id} className="text-center p-2 font-medium min-w-[80px]">{cat?.name}</th>;
                            })}
                            <th className="text-center p-2 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedTeams.map((t) => {
                            const team = teams.find((tm) => tm.id === t.teamId);
                            return (
                              <tr key={t.teamId} className="border-t border-border">
                                <td className="p-2 font-medium">{t.alias || team?.name}</td>
                                {selectedCats.map((id) => (
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
