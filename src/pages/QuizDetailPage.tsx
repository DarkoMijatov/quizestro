import { useState, useEffect, useCallback, useRef, KeyboardEvent, FocusEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Loader2, Play, CheckCircle, Unlock, Download, ChevronLeft, ChevronRight, Pencil } from
'lucide-react';
import { exportQuizToExcel } from '@/lib/excelUtils';
import { QuizDraftManager } from '@/components/QuizDraftManager';

interface QuizData {
  id: string;
  name: string;
  date: string;
  location: string | null;
  status: 'draft' | 'live' | 'finished';
  organization_id: string;
}

interface QuizCategory {
  id: string;
  category_id: string;
  sort_order: number | null;
  category: {name: string;};
}

interface QuizTeam {
  id: string;
  team_id: string;
  alias: string | null;
  total_points: number | null;
  rank: number | null;
  team: {name: string;};
}

interface Score {
  id: string;
  quiz_team_id: string;
  quiz_category_id: string;
  points: number;
  bonus_points: number;
  is_locked: boolean;
}

interface HelpType {
  id: string;
  name: string;
  effect: string;
}

interface HelpUsage {
  id: string;
  help_type_id: string;
  quiz_team_id: string;
  quiz_category_id: string;
}

export default function QuizDetailPage() {
  const { t } = useTranslation();
  const { id: quizId } = useParams<{id: string;}>();
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [teams, setTeams] = useState<QuizTeam[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [helpTypes, setHelpTypes] = useState<HelpType[]>([]);
  const [helpUsages, setHelpUsages] = useState<HelpUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAliasTeamId, setEditingAliasTeamId] = useState<string | null>(null);
  const [editingAliasValue, setEditingAliasValue] = useState('');

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const canEdit = currentRole === 'owner' || currentRole === 'admin';




  const fetchAll = useCallback(async () => {
    if (!quizId || !currentOrg) return;
    setLoading(true);

    const [quizRes, catRes, teamRes, scoreRes, helpTypeRes, helpUsageRes] = await Promise.all([
    supabase.from('quizzes').select('*').eq('id', quizId).single(),
    supabase.from('quiz_categories').select('*, category:categories(name)').eq('quiz_id', quizId).order('sort_order'),
    supabase.from('quiz_teams').select('*, team:teams(name)').eq('quiz_id', quizId).order('total_points', { ascending: false }),
    supabase.from('scores').select('*').eq('quiz_id', quizId),
    supabase.from('help_types').select('*').eq('organization_id', currentOrg.id),
    supabase.from('help_usages').select('*').eq('quiz_id', quizId)]
    );

    setQuiz(quizRes.data as any);
    setCategories(catRes.data as any || []);
    setTeams(teamRes.data as any || []);
    setScores(scoreRes.data as any || []);
    setHelpTypes(helpTypeRes.data as any || []);
    setHelpUsages(helpUsageRes.data as any || []);
    setLoading(false);
  }, [quizId, currentOrg?.id]);

  useEffect(() => {fetchAll();}, [fetchAll]);

  const getScore = (teamId: string, catId: string) =>
  scores.find((s) => s.quiz_team_id === teamId && s.quiz_category_id === catId);

  const getHelpUsage = (teamId: string, catId: string, helpTypeId: string) =>
  helpUsages.find((h) => h.quiz_team_id === teamId && h.quiz_category_id === catId && h.help_type_id === helpTypeId);

  const jokerType = helpTypes.find((h) => h.effect === 'double');
  const markerType = helpTypes.find((h) => h.effect === 'marker');

  const hasTeamUsedHelp = (teamId: string, helpTypeId: string) =>
  helpUsages.some((h) => h.quiz_team_id === teamId && h.help_type_id === helpTypeId);

  const updateScore = async (scoreId: string, field: 'points' | 'bonus_points', value: number) => {
    const update: any = { [field]: value };
    await supabase.from('scores').update(update).eq('id', scoreId);
    setScores((prev) =>
    prev.map((s) => s.id === scoreId ? { ...s, [field]: value } : s)
    );
  };

  const startEditAlias = (team: QuizTeam) => {
    setEditingAliasTeamId(team.id);
    setEditingAliasValue(team.alias || (team.team as any)?.name || '');
  };

  const saveAlias = async () => {
    if (!editingAliasTeamId) return;
    const trimmed = editingAliasValue.trim();
    if (trimmed) {
      const duplicate = teams.find(
        (t) => t.id !== editingAliasTeamId && (t.alias || (t.team as any)?.name || '').toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) {
        toast({ title: t('scoring.aliasNotUnique', 'Alias already used by another team in this quiz'), variant: 'destructive' });
        return;
      }
    }
    await supabase.from('quiz_teams').update({ alias: trimmed || null }).eq('id', editingAliasTeamId);
    setTeams((prev) =>
    prev.map((t) => t.id === editingAliasTeamId ? { ...t, alias: trimmed || null } : t)
    );
    setEditingAliasTeamId(null);
  };

  const handleAliasKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') saveAlias();
    if (e.key === 'Escape') setEditingAliasTeamId(null);
  };

  const toggleHelp = async (teamId: string, catId: string, helpType: HelpType) => {
    if (!currentOrg || !quizId) return;
    const existing = getHelpUsage(teamId, catId, helpType.id);

    if (existing) {
      await supabase.from('help_usages').delete().eq('id', existing.id);
      setHelpUsages((prev) => prev.filter((h) => h.id !== existing.id));
    } else {
      if (hasTeamUsedHelp(teamId, helpType.id)) {
        toast({ title: t('scoring.helpAlreadyUsed'), variant: 'destructive' });
        return;
      }
      const { data } = await supabase.from('help_usages').insert({
        help_type_id: helpType.id,
        quiz_team_id: teamId,
        quiz_category_id: catId,
        quiz_id: quizId,
        organization_id: currentOrg.id
      }).select().single();
      if (data) setHelpUsages((prev) => [...prev, data as any]);
    }
  };

  const getTeamTotal = (teamId: string) => {
    let total = 0;
    for (const cat of categories) {
      const score = getScore(teamId, cat.id);
      if (!score) continue;
      let catPoints = score.points + score.bonus_points;
      if (jokerType && getHelpUsage(teamId, cat.id, jokerType.id)) {
        catPoints *= 2;
      }
      total += catPoints;
    }
    return total;
  };

  const rankedTeams = [...teams].sort((a, b) => getTeamTotal(b.id) - getTeamTotal(a.id));

  const handleExport = () => {
    if (!quiz) return;
    const exportData = {
      quizName: quiz.name,
      quizDate: quiz.date,
      categories: categories.map((c) => (c.category as any)?.name || c.category_id),
      rows: rankedTeams.map((team, idx) => {
        const teamName = (team.team as any)?.name || '';
        const rowScores: Record<string, number> = {};
        for (const cat of categories) {
          const catName = (cat.category as any)?.name || cat.category_id;
          const score = getScore(team.id, cat.id);
          rowScores[catName] = score?.points ?? 0;
        }
        return {
          teamName,
          teamAlias: team.alias,
          scores: rowScores,
          total: getTeamTotal(team.id),
          rank: idx + 1
        };
      })
    };
    exportQuizToExcel(exportData);
  };

  const swapCategories = async (idx: number, dir: -1 | 1) => {
    const newCats = [...categories];
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= newCats.length) return;
    [newCats[idx], newCats[targetIdx]] = [newCats[targetIdx], newCats[idx]];
    // Update sort_order for both
    const updates = newCats.map((c, i) => ({ id: c.id, sort_order: i }));
    setCategories(newCats);
    await Promise.all(
      updates.map((u) => supabase.from('quiz_categories').update({ sort_order: u.sort_order }).eq('id', u.id))
    );
  };

  const updateQuizStatus = async (status: 'draft' | 'live' | 'finished') => {
    if (!quizId) return;
    await supabase.from('quizzes').update({ status }).eq('id', quizId);
    setQuiz((prev) => prev ? { ...prev, status } : prev);

    if (status === 'finished') {
      for (let i = 0; i < rankedTeams.length; i++) {
        const team = rankedTeams[i];
        await supabase.from('quiz_teams').update({
          total_points: getTeamTotal(team.id),
          rank: i + 1
        }).eq('id', team.id);
      }
    }
    toast({ title: '✓', description: t('scoring.statusUpdated') });
  };

  // Keyboard navigation: arrow keys move between score inputs
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    let targetRow = rowIdx;
    let targetCol = colIdx;

    if (e.key === 'ArrowDown') {targetRow = Math.min(rowIdx + 1, rankedTeams.length - 1);e.preventDefault();} else
    if (e.key === 'ArrowUp') {targetRow = Math.max(rowIdx - 1, 0);e.preventDefault();} else
    if (e.key === 'ArrowRight' || e.key === 'Tab') {
      if (colIdx < categories.length - 1) {targetCol = colIdx + 1;e.preventDefault();} else
      if (rowIdx < rankedTeams.length - 1) {targetRow = rowIdx + 1;targetCol = 0;e.preventDefault();}
    } else
    if (e.key === 'ArrowLeft') {
      if (colIdx > 0) {targetCol = colIdx - 1;e.preventDefault();} else
      if (rowIdx > 0) {targetRow = rowIdx - 1;targetCol = categories.length - 1;e.preventDefault();}
    } else
    return;

    const key = `${targetRow}-${targetCol}`;
    const el = inputRefs.current.get(key);
    if (el) {el.focus();el.select();}
  };

  const setInputRef = (rowIdx: number, colIdx: number, el: HTMLInputElement | null) => {
    const key = `${rowIdx}-${colIdx}`;
    if (el) inputRefs.current.set(key, el);else
    inputRefs.current.delete(key);
  };

  const getInitials = (name: string) => {
    return name.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>);

  }

  if (!quiz) {
    return (
      <DashboardLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">{t('scoring.notFound')}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/dashboard/quizzes')}>
            {t('common.back')}
          </Button>
        </div>
      </DashboardLayout>);

  }

  const isDraft = quiz.status === 'draft';
  const isLive = quiz.status === 'live';
  const isFinished = quiz.status === 'finished';
  const canScore = canEdit && isLive; // score editing only when live
  const canReorder = canEdit && isDraft; // reorder only in draft
  const colCount = categories.length;

  // Dynamic sizing: scale fonts/padding based on team count to fit screen
  const teamCount = rankedTeams.length;
  const sizeClass = teamCount <= 6 ? 'size-lg' : teamCount <= 10 ? 'size-md' : teamCount <= 15 ? 'size-sm' : 'size-xs';

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/quizzes')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{quiz.name}</h1>
          </div>
           <div className="flex items-center gap-2">
            {currentOrg?.logo_url &&
            <img src={currentOrg.logo_url} alt="" className="h-8 w-auto object-contain" />
            }
            {canReorder &&
            <QuizDraftManager
              quizId={quizId!}
              organizationId={currentOrg!.id}
              quizCategories={categories}
              quizTeams={teams}
              onChanged={fetchAll} />

            }
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
              <Download className="h-4 w-4" /> {t('excel.export')}
            </Button>
            {canEdit && quiz.status === 'draft' &&
            <Button onClick={() => updateQuizStatus('live')} className="gap-2">
                <Play className="h-4 w-4" /> {t('scoring.goLive')}
              </Button>
            }
            {canEdit && quiz.status === 'live' &&
            <Button onClick={() => updateQuizStatus('finished')} className="gap-2">
                <CheckCircle className="h-4 w-4" /> {t('scoring.finish')}
              </Button>
            }
            {canEdit && quiz.status === 'finished' &&
            <Button onClick={() => updateQuizStatus('live')} variant="outline" className="gap-2">
                <Unlock className="h-4 w-4" /> {t('scoring.reopen')}
              </Button>
            }
          </div>
        </div>

        {/* Scoring Table */}
        <div
          className="rounded-xl border-2 border-foreground/20 shadow-md overflow-auto min-h-0 flex-1 mt-2"
          style={{
            backgroundColor: currentOrg?.branding_bg_color || undefined,
            color: currentOrg?.branding_text_color || undefined
          }}>
          
          <div style={{ minWidth: `${140 + categories.length * 90 + 70}px` }}>
          {/* Header row */}
          <div
              className="grid border-b-2 border-foreground/20 sticky top-0 z-10"
              style={{
                gridTemplateColumns: `140px ${categories.map(() => '1fr').join(' ')} 70px`,
                backgroundColor: currentOrg?.branding_header_color || undefined
              }}>
              
            <div className={cn("p-1.5 font-bold uppercase tracking-wide flex items-center justify-center text-center", sizeClass === 'size-xs' ? 'text-[10px]' : 'text-xs')}
              style={{ color: currentOrg?.branding_text_color || undefined }}>
                
              {t('scoring.team')}
            </div>
            {categories.map((cat, catIdx) =>
              <div key={cat.id} className={cn("p-1.5 font-bold uppercase tracking-wide text-center border-l-2 border-foreground/20 break-words leading-tight flex flex-col items-center justify-center gap-0.5", sizeClass === 'size-xs' ? 'text-[9px]' : 'text-[10px]')}
              style={{ color: currentOrg?.branding_text_color || undefined }}>
                
                {canReorder && categories.length > 1 &&
                <div className="flex items-center gap-0.5">
                    <button onClick={() => swapCategories(catIdx, -1)} disabled={catIdx === 0} className="p-0 disabled:opacity-20 hover:text-primary transition-colors">
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <button onClick={() => swapCategories(catIdx, 1)} disabled={catIdx === categories.length - 1} className="p-0 disabled:opacity-20 hover:text-primary transition-colors">
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                }
                {(cat.category as any)?.name || cat.category_id}
              </div>
              )}
            <div className={cn("p-1.5 font-bold uppercase tracking-wide text-center border-l-2 border-foreground/20 flex items-center justify-center", sizeClass === 'size-xs' ? 'text-[10px]' : 'text-xs')}
              style={{ color: currentOrg?.branding_text_color || undefined }}>
                
              Σ
            </div>
          </div>

          <div className="flex flex-col">
          {rankedTeams.map((team, rowIdx) => {
                const total = getTeamTotal(team.id);
                const teamName = team.alias || (team.team as any)?.name || '';


                return (
                  <div
                    key={team.id}
                    className={cn(
                      'grid border-b-2 border-foreground/20 last:border-0',
                      rowIdx === 0 && 'bg-primary/[0.04]'
                    )}
                    style={{
                      gridTemplateColumns: `140px ${categories.map(() => '1fr').join(' ')} 70px`
                    }}>
                    
                {/* Rank + Team */}
                <div className={cn("flex items-center gap-1.5", sizeClass === 'size-xs' ? 'p-0.5' : 'p-1')}>
                  <div className={cn("flex-shrink-0 rounded-full bg-foreground/10 flex items-center justify-center font-black text-foreground",
                      sizeClass === 'size-lg' ? 'w-8 h-8 text-base' : sizeClass === 'size-md' ? 'w-7 h-7 text-sm' : sizeClass === 'size-sm' ? 'w-6 h-6 text-xs' : 'w-5 h-5 text-[10px]'
                      )}>
                    {rowIdx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    {editingAliasTeamId === team.id ?
                        <input
                          autoFocus
                          className={cn(
                            "w-full bg-transparent border-b border-primary outline-none font-bold text-foreground",
                            sizeClass === 'size-lg' ? 'text-sm' : sizeClass === 'size-md' ? 'text-xs' : 'text-[10px]'
                          )}
                          value={editingAliasValue}
                          onChange={(e) => setEditingAliasValue(e.target.value)}
                          onBlur={saveAlias}
                          onKeyDown={handleAliasKeyDown} /> :


                        <div className="flex items-center gap-1 group cursor-pointer" onClick={() => canEdit && startEditAlias(team)}>
                        <p className={cn("font-bold text-foreground break-words leading-tight text-lg",
                          sizeClass === 'size-lg' ? 'text-sm' : sizeClass === 'size-md' ? 'text-xs' : 'text-[10px]'
                          )}>{teamName}</p>
                        {canEdit && <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />}
                      </div>
                        }
                  </div>
                </div>

                {/* Category scores */}
                {categories.map((cat, colIdx) => {
                      const score = getScore(team.id, cat.id);
                      const hasJoker = jokerType && getHelpUsage(team.id, cat.id, jokerType.id);
                      const hasMarker = markerType && getHelpUsage(team.id, cat.id, markerType.id);

                      // Disable help if team already used it in another category
                      const jokerDisabledElsewhere = jokerType && !hasJoker && hasTeamUsedHelp(team.id, jokerType.id);
                      const markerDisabledElsewhere = markerType && !hasMarker && hasTeamUsedHelp(team.id, markerType.id);

                      return (
                        <div
                          key={cat.id}
                          className={cn(
                            'p-1 flex flex-col items-center justify-center gap-0.5 border-l-2 border-foreground/20',
                            hasJoker && 'bg-primary/[0.08]'
                          )}>
                          
                      {canScore ?
                          <>
                          <input
                              ref={(el) => setInputRef(rowIdx, colIdx, el)}
                              type="number"
                              min={0}
                              step={0.5}
                              value={score?.points ?? 0}
                              onChange={(e) => score && updateScore(score.id, 'points', Number(e.target.value) || 0)}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => handleInputKeyDown(e, rowIdx, colIdx)}
                              tabIndex={rowIdx * colCount + colIdx + 1}
                              className={cn("w-full text-center font-black text-foreground bg-transparent border-2 border-foreground/15 rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors",
                              sizeClass === 'size-lg' ? 'h-14 text-3xl' : sizeClass === 'size-md' ? 'h-10 text-2xl' : sizeClass === 'size-sm' ? 'h-8 text-xl' : 'h-6 text-base'
                              )} />
                            
                          {/* Help initials */}
                          <div className="flex items-center gap-0.5">
                            {jokerType &&
                              <button
                                onClick={() => toggleHelp(team.id, cat.id, jokerType)}
                                disabled={!!jokerDisabledElsewhere}
                                tabIndex={-1}
                                className={cn(
                                  'w-6 h-5 rounded text-[9px] font-black border transition-colors',
                                  hasJoker ?
                                  'bg-primary text-primary-foreground border-primary' :
                                  jokerDisabledElsewhere ?
                                  'bg-muted text-muted-foreground/40 border-border cursor-not-allowed' :
                                  'bg-background text-foreground/60 border-foreground/20 hover:border-primary hover:text-primary'
                                )}>
                                
                                {getInitials(jokerType.name)}
                              </button>
                              }
                            {markerType &&
                              <button
                                onClick={() => toggleHelp(team.id, cat.id, markerType)}
                                disabled={!!markerDisabledElsewhere}
                                tabIndex={-1}
                                className={cn(
                                  'w-6 h-5 rounded text-[9px] font-black border transition-colors',
                                  hasMarker ?
                                  'bg-accent text-accent-foreground border-accent' :
                                  markerDisabledElsewhere ?
                                  'bg-muted text-muted-foreground/40 border-border cursor-not-allowed' :
                                  'bg-background text-foreground/60 border-foreground/20 hover:border-accent hover:text-accent-foreground'
                                )}>
                                
                                {getInitials(markerType.name)}
                              </button>
                              }
                          </div>
                        </> :

                          <div className="flex flex-col items-center gap-0.5">
                          <p className={cn("font-black text-foreground", sizeClass === 'size-lg' ? 'text-3xl' : sizeClass === 'size-md' ? 'text-2xl' : sizeClass === 'size-sm' ? 'text-xl' : 'text-base')}>
                            {score?.points ?? 0}
                          </p>
                          {hasJoker &&
                            <span className="text-[10px] text-primary font-black">×2</span>
                            }
                        </div>
                          }
                    </div>);

                    })}

                {/* Total */}
                <div className="p-1 flex items-center justify-center border-l-2 border-foreground/20">
                  <span className={cn("font-black text-primary", sizeClass === 'size-lg' ? 'text-3xl' : sizeClass === 'size-md' ? 'text-2xl' : sizeClass === 'size-sm' ? 'text-xl' : 'text-base')}>{total % 1 === 0 ? total : total.toFixed(1)}</span>
                </div>
              </div>);

              })}
          </div>
          </div>
        </div>
      </div>

      
    </DashboardLayout>);

}