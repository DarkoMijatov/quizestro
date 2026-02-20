import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { parseQuizExcel, type ImportResult, type ImportedRow } from '@/lib/excelUtils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Upload, AlertTriangle } from 'lucide-react';

interface Team {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface HelpType {
  id: string;
  name: string;
  effect: string;
}

interface UnknownTeam {
  importedName: string;
  resolution: 'new' | 'alias';
  aliasOfTeamId?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  quizId: string;
  organizationId: string;
  existingTeams: Team[];
  existingCategories: Category[];
  helpTypes: HelpType[];
  onImportComplete: () => void;
}

export function ImportExcelDialog({
  open, onClose, quizId, organizationId,
  existingTeams, existingCategories, helpTypes, onImportComplete,
}: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [unknownTeams, setUnknownTeams] = useState<UnknownTeam[]>([]);
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [step, setStep] = useState<'upload' | 'resolve'>('upload');

  const reset = () => {
    setParsed(null);
    setUnknownTeams([]);
    setNewCategories([]);
    setStep('upload');
    setImporting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await parseQuizExcel(file);
      setParsed(result);

      // Find new categories
      const existingNames = new Set(existingCategories.map(c => c.name.toLowerCase()));
      const newCats = result.categories.filter(c => !existingNames.has(c.toLowerCase()));
      setNewCategories(newCats);

      // Find unknown teams
      const existingNameSet = new Set(existingTeams.map(t => t.name.toLowerCase()));
      const unknown: UnknownTeam[] = [];
      for (const row of result.rows) {
        const name = row.teamName.toLowerCase();
        if (!existingNameSet.has(name)) {
          unknown.push({ importedName: row.teamName, resolution: 'new' });
        }
      }
      setUnknownTeams(unknown);

      if (newCats.length > 0 || unknown.length > 0) {
        setStep('resolve');
      } else {
        // All known, proceed to import
        await doImport(result, [], []);
      }
    } catch (err: any) {
      toast({ title: t('excel.importError'), description: err.message, variant: 'destructive' });
    }
  };

  const updateTeamResolution = (idx: number, resolution: 'new' | 'alias', aliasOfTeamId?: string) => {
    setUnknownTeams(prev => prev.map((ut, i) =>
      i === idx ? { ...ut, resolution, aliasOfTeamId } : ut
    ));
  };

  const doImport = async (
    result: ImportResult,
    resolvedUnknownTeams: UnknownTeam[],
    newCats: string[],
  ) => {
    setImporting(true);
    try {
      // 1. Create new categories
      const catMap = new Map<string, string>(); // name (lower) -> id
      for (const c of existingCategories) {
        catMap.set(c.name.toLowerCase(), c.id);
      }
      for (const catName of newCats) {
        const { data } = await supabase.from('categories').insert({
          name: catName, organization_id: organizationId,
        }).select('id').single();
        if (data) catMap.set(catName.toLowerCase(), data.id);
      }

      // 2. Resolve teams
      const teamMap = new Map<string, string>(); // name (lower) -> id
      for (const t of existingTeams) {
        teamMap.set(t.name.toLowerCase(), t.id);
      }

      for (const ut of resolvedUnknownTeams) {
        if (ut.resolution === 'alias' && ut.aliasOfTeamId) {
          // Add alias
          await supabase.from('team_aliases').insert({
            team_id: ut.aliasOfTeamId,
            alias: ut.importedName,
            organization_id: organizationId,
          });
          teamMap.set(ut.importedName.toLowerCase(), ut.aliasOfTeamId);
        } else {
          // Create new team
          const { data } = await supabase.from('teams').insert({
            name: ut.importedName, organization_id: organizationId,
          }).select('id').single();
          if (data) teamMap.set(ut.importedName.toLowerCase(), data.id);
        }
      }

      // 3. Ensure quiz_categories exist
      const { data: existingQC } = await supabase.from('quiz_categories')
        .select('id, category_id')
        .eq('quiz_id', quizId);
      const existingQCMap = new Map<string, string>(); // cat_id -> qc_id
      for (const qc of existingQC || []) {
        existingQCMap.set(qc.category_id, qc.id);
      }

      for (const catName of result.categories) {
        const catId = catMap.get(catName.toLowerCase());
        if (catId && !existingQCMap.has(catId)) {
          const { data } = await supabase.from('quiz_categories').insert({
            quiz_id: quizId, category_id: catId, organization_id: organizationId,
            sort_order: result.categories.indexOf(catName),
          }).select('id').single();
          if (data) existingQCMap.set(catId, data.id);
        }
      }

      // 4. Ensure quiz_teams exist
      const { data: existingQT } = await supabase.from('quiz_teams')
        .select('id, team_id')
        .eq('quiz_id', quizId);
      const existingQTMap = new Map<string, string>(); // team_id -> qt_id
      for (const qt of existingQT || []) {
        existingQTMap.set(qt.team_id, qt.id);
      }

      for (const row of result.rows) {
        const teamId = teamMap.get(row.teamName.toLowerCase());
        if (teamId && !existingQTMap.has(teamId)) {
          const { data } = await supabase.from('quiz_teams').insert({
            quiz_id: quizId, team_id: teamId, organization_id: organizationId,
            alias: row.teamAlias || null,
          }).select('id').single();
          if (data) existingQTMap.set(teamId, data.id);
        }
      }

      // 5. Upsert scores
      for (const row of result.rows) {
        const teamId = teamMap.get(row.teamName.toLowerCase());
        if (!teamId) continue;
        const qtId = existingQTMap.get(teamId);
        if (!qtId) continue;

        for (const catName of result.categories) {
          const catId = catMap.get(catName.toLowerCase());
          if (!catId) continue;
          const qcId = existingQCMap.get(catId);
          if (!qcId) continue;

          const points = row.scores[catName] ?? 0;

          // Check if score exists
          const { data: existingScore } = await supabase.from('scores')
            .select('id')
            .eq('quiz_team_id', qtId)
            .eq('quiz_category_id', qcId)
            .eq('quiz_id', quizId)
            .maybeSingle();

          if (existingScore) {
            await supabase.from('scores').update({ points }).eq('id', existingScore.id);
          } else {
            await supabase.from('scores').insert({
              quiz_id: quizId, quiz_team_id: qtId, quiz_category_id: qcId,
              organization_id: organizationId, points,
            });
          }

          // Handle help usages
          const helps = row.helpUsages[catName] || [];
          for (const helpName of helps) {
            const ht = helpTypes.find(h => h.name.toLowerCase() === helpName.toLowerCase());
            if (!ht) continue;
            const { data: existingUsage } = await supabase.from('help_usages')
              .select('id')
              .eq('quiz_team_id', qtId)
              .eq('quiz_category_id', qcId)
              .eq('help_type_id', ht.id)
              .eq('quiz_id', quizId)
              .maybeSingle();
            if (!existingUsage) {
              await supabase.from('help_usages').insert({
                help_type_id: ht.id, quiz_team_id: qtId, quiz_category_id: qcId,
                quiz_id: quizId, organization_id: organizationId,
              });
            }
          }
        }
      }

      toast({ title: '✓', description: t('excel.importSuccess') });
      onImportComplete();
      handleClose();
    } catch (err: any) {
      toast({ title: t('excel.importError'), description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmResolve = () => {
    // Validate all alias resolutions have a team selected
    for (const ut of unknownTeams) {
      if (ut.resolution === 'alias' && !ut.aliasOfTeamId) {
        toast({ title: t('excel.selectTeam'), variant: 'destructive' });
        return;
      }
    }
    if (parsed) {
      doImport(parsed, unknownTeams, newCategories);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('excel.importTitle')}</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">{t('excel.importDescription')}</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full gap-2">
              <Upload className="h-4 w-4" />
              {t('excel.selectFile')}
            </Button>
          </div>
        )}

        {step === 'resolve' && (
          <div className="space-y-6 py-4">
            {newCategories.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  {t('excel.newCategories')}
                </div>
                <div className="space-y-1">
                  {newCategories.map(c => (
                    <div key={c} className="rounded-lg border border-border px-3 py-2 text-sm bg-muted/50">
                      {c} — <span className="text-muted-foreground">{t('excel.willBeCreated')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {unknownTeams.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  {t('excel.unknownTeams')}
                </div>
                {unknownTeams.map((ut, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
                    <p className="text-sm font-medium">"{ut.importedName}"</p>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">{t('excel.resolution')}:</Label>
                      <Select
                        value={ut.resolution}
                        onValueChange={(v: 'new' | 'alias') => updateTeamResolution(idx, v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">{t('excel.createNewTeam')}</SelectItem>
                          <SelectItem value="alias">{t('excel.aliasOfExisting')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {ut.resolution === 'alias' && (
                      <Select
                        value={ut.aliasOfTeamId || ''}
                        onValueChange={(v) => updateTeamResolution(idx, 'alias', v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={t('excel.selectTeam')} />
                        </SelectTrigger>
                        <SelectContent>
                          {existingTeams.map(team => (
                            <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>{t('common.cancel')}</Button>
              <Button onClick={handleConfirmResolve} disabled={importing}>
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t('excel.confirmImport')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
