import { useState, useEffect, useCallback, useRef, KeyboardEvent, FocusEvent } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useOfflineScoreQueue } from "@/hooks/useOfflineScoreQueue";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/DashboardLayout";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  Play,
  CheckCircle,
  Unlock,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Pencil,
  Crown,
  Zap,
  CopyCheck,
  Maximize2,
  Minimize2,
  Layers,
} from "lucide-react";
import { exportQuizToExcel } from "@/lib/excelUtils";
import { QuizDraftManager } from "@/components/QuizDraftManager";

interface QuizData {
  id: string;
  name: string;
  date: string;
  location: string | null;
  status: "draft" | "live" | "finished";
  organization_id: string;
  scoring_mode: "per_category" | "per_part";
}

interface QuizPart {
  id: string;
  quiz_id: string;
  part_number: number;
  name: string;
}

interface PartScore {
  id: string;
  quiz_part_id: string;
  quiz_team_id: string;
  points: number;
}

interface QuizCategory {
  id: string;
  category_id: string;
  sort_order: number | null;
  quiz_part_id: string | null;
  category: { name: string };
}

interface QuizTeam {
  id: string;
  team_id: string;
  alias: string | null;
  total_points: number | null;
  rank: number | null;
  team: { name: string };
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

interface CategoryBonus {
  id: string;
  quiz_id: string;
  quiz_category_id: string;
  quiz_team_id: string;
  organization_id: string;
}

export default function QuizDetailPage() {
  const { t } = useTranslation();
  const { id: quizId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOrg, currentRole } = useOrganizations();
  const { toast } = useToast();

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [categories, setCategories] = useState<QuizCategory[]>([]);
  const [teams, setTeams] = useState<QuizTeam[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [helpTypes, setHelpTypes] = useState<HelpType[]>([]);
  const [helpUsages, setHelpUsages] = useState<HelpUsage[]>([]);
  const [categoryBonuses, setCategoryBonuses] = useState<CategoryBonus[]>([]);
  const [quizParts, setQuizParts] = useState<QuizPart[]>([]);
  const [partScores, setPartScores] = useState<PartScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAliasTeamId, setEditingAliasTeamId] = useState<string | null>(null);
  const [editingAliasValue, setEditingAliasValue] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusedCell, setFocusedCell] = useState<string | null>(null);
  const [scoringView, setScoringView] = useState<"categories" | "parts">("categories");
  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const scoringRef = useRef<HTMLDivElement>(null);

  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const canEdit = currentRole === "owner" || currentRole === "admin";

  const { isOnline, pendingCount, syncing, enqueueScoreUpdate, enqueueHelpToggle, enqueueCategoryBonus } =
    useOfflineScoreQueue({ quizId, onSynced: () => fetchAll() });

  const fetchAll = useCallback(async () => {
    if (!quizId || !currentOrg) return;
    setLoading(true);

    const [quizRes, catRes, teamRes, scoreRes, helpTypeRes, helpUsageRes, catBonusRes, partsRes, partScoresRes] = await Promise.all([
      supabase.from("quizzes").select("*").eq("id", quizId).single(),
      supabase.from("quiz_categories").select("*, category:categories(name)").eq("quiz_id", quizId).order("sort_order"),
      supabase
        .from("quiz_teams")
        .select("*, team:teams(name)")
        .eq("quiz_id", quizId)
        .order("total_points", { ascending: false }),
      supabase.from("scores").select("*").eq("quiz_id", quizId),
      supabase.from("help_types").select("*").eq("organization_id", currentOrg.id),
      supabase.from("help_usages").select("*").eq("quiz_id", quizId),
      supabase.from("category_bonuses").select("*").eq("quiz_id", quizId),
      supabase.from("quiz_parts").select("*").eq("quiz_id", quizId).order("part_number"),
      supabase.from("part_scores").select("*").eq("quiz_id", quizId),
    ]);

    const quizData = quizRes.data as any;
    setQuiz(quizData);
    setCategories((catRes.data as any) || []);
    setTeams((teamRes.data as any) || []);
    setScores((scoreRes.data as any) || []);
    setHelpTypes((helpTypeRes.data as any) || []);
    setHelpUsages((helpUsageRes.data as any) || []);
    setCategoryBonuses((catBonusRes.data as any) || []);
    setQuizParts((partsRes.data as any) || []);
    setPartScores((partScoresRes.data as any) || []);

    // Default view based on scoring mode
    if (quizData?.scoring_mode === "per_part") {
      setScoringView("parts");
    }

    setLoading(false);
  }, [quizId, currentOrg?.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Fullscreen API: sync state with browser fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await scoringRef.current?.requestFullscreen();
    }
  };

  const getScore = (teamId: string, catId: string) =>
    scores.find((s) => s.quiz_team_id === teamId && s.quiz_category_id === catId);

  const getHelpUsage = (teamId: string, catId: string, helpTypeId: string) =>
    helpUsages.find((h) => h.quiz_team_id === teamId && h.quiz_category_id === catId && h.help_type_id === helpTypeId);

  const jokerType = helpTypes.find((h) => h.effect === "double");
  const markerType = helpTypes.find((h) => h.effect === "second_chance" || h.effect === "marker");
  const categoryBonusEnabled = helpTypes.some((h) => h.effect === "category_bonus");

  const hasTeamUsedHelp = (teamId: string, helpTypeId: string) =>
    helpUsages.some((h) => h.quiz_team_id === teamId && h.help_type_id === helpTypeId);

  const getCategoryBonus = (catId: string) => categoryBonuses.find((cb) => cb.quiz_category_id === catId);

  const hasCategoryBonus = (teamId: string, catId: string) => {
    const bonus = getCategoryBonus(catId);
    return bonus && bonus.quiz_team_id === teamId;
  };

  /** Get display points for a cell (with joker doubling + category bonus, but joker doesn't double the bonus) */
  const getDisplayPoints = (teamId: string, catId: string) => {
    const score = getScore(teamId, catId);
    if (!score) return 0;
    let catPoints = score.points + score.bonus_points;
    if (jokerType && getHelpUsage(teamId, catId, jokerType.id)) {
      catPoints *= 2;
    }
    if (hasCategoryBonus(teamId, catId)) {
      catPoints += 1;
    }
    return catPoints;
  };

  const updateScore = async (scoreId: string, field: "points" | "bonus_points", value: number) => {
    // Optimistic local update
    setScores((prev) => prev.map((s) => (s.id === scoreId ? { ...s, [field]: value } : s)));

    if (isOnline) {
      const update: any = { [field]: value };
      await supabase.from("scores").update(update).eq("id", scoreId);
    } else {
      enqueueScoreUpdate(scoreId, field, value);
    }
  };

  const toggleCategoryBonus = async (teamId: string, catId: string) => {
    if (!currentOrg || !quizId) return;
    const existing = getCategoryBonus(catId);

    if (existing) {
      if (existing.quiz_team_id === teamId) {
        // Remove bonus from this team
        setCategoryBonuses((prev) => prev.filter((cb) => cb.id !== existing.id));
        if (isOnline) {
          await supabase.from("category_bonuses").delete().eq("id", existing.id);
        } else {
          enqueueCategoryBonus({ action: "remove", quizCategoryId: catId });
        }
      } else {
        // Switch bonus to this team
        setCategoryBonuses((prev) => prev.filter((cb) => cb.id !== existing.id));
        if (isOnline) {
          await supabase.from("category_bonuses").delete().eq("id", existing.id);
          const { data } = await supabase
            .from("category_bonuses")
            .insert({
              quiz_id: quizId,
              quiz_category_id: catId,
              quiz_team_id: teamId,
              organization_id: currentOrg.id,
            })
            .select()
            .single();
          if (data) setCategoryBonuses((prev) => [...prev, data as any]);
        } else {
          const localId = enqueueCategoryBonus({
            action: "set",
            quizCategoryId: catId,
            quizTeamId: teamId,
            quizId,
            organizationId: currentOrg.id,
            previousId: existing.id,
          });
          setCategoryBonuses((prev) => [
            ...prev,
            {
              id: localId,
              quiz_id: quizId,
              quiz_category_id: catId,
              quiz_team_id: teamId,
              organization_id: currentOrg.id,
            } as any,
          ]);
        }
      }
    } else {
      // Award bonus to this team
      if (isOnline) {
        const { data } = await supabase
          .from("category_bonuses")
          .insert({
            quiz_id: quizId,
            quiz_category_id: catId,
            quiz_team_id: teamId,
            organization_id: currentOrg.id,
          })
          .select()
          .single();
        if (data) setCategoryBonuses((prev) => [...prev, data as any]);
      } else {
        const localId = enqueueCategoryBonus({
          action: "set",
          quizCategoryId: catId,
          quizTeamId: teamId,
          quizId,
          organizationId: currentOrg.id,
        });
        setCategoryBonuses((prev) => [
          ...prev,
          {
            id: localId,
            quiz_id: quizId,
            quiz_category_id: catId,
            quiz_team_id: teamId,
            organization_id: currentOrg.id,
          } as any,
        ]);
      }
    }
  };

  const startEditAlias = (team: QuizTeam) => {
    setEditingAliasTeamId(team.id);
    setEditingAliasValue(team.alias || (team.team as any)?.name || "");
  };

  const saveAlias = async () => {
    if (!editingAliasTeamId) return;
    const trimmed = editingAliasValue.trim();
    if (trimmed) {
      const duplicate = teams.find(
        (t) =>
          t.id !== editingAliasTeamId &&
          (t.alias || (t.team as any)?.name || "").toLowerCase() === trimmed.toLowerCase(),
      );
      if (duplicate) {
        toast({
          title: t("scoring.aliasNotUnique", "Alias already used by another team in this quiz"),
          variant: "destructive",
        });
        return;
      }
    }
    await supabase
      .from("quiz_teams")
      .update({ alias: trimmed || null })
      .eq("id", editingAliasTeamId);
    setTeams((prev) => prev.map((t) => (t.id === editingAliasTeamId ? { ...t, alias: trimmed || null } : t)));
    setEditingAliasTeamId(null);
  };

  const handleAliasKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") saveAlias();
    if (e.key === "Escape") setEditingAliasTeamId(null);
  };

  const toggleHelp = async (teamId: string, catId: string, helpType: HelpType) => {
    if (!currentOrg || !quizId) return;
    const existing = getHelpUsage(teamId, catId, helpType.id);

    if (existing) {
      // Optimistic remove
      setHelpUsages((prev) => prev.filter((h) => h.id !== existing.id));
      if (isOnline) {
        await supabase.from("help_usages").delete().eq("id", existing.id);
      } else {
        enqueueHelpToggle({ action: "remove", helpUsageId: existing.id });
      }
    } else {
      if (hasTeamUsedHelp(teamId, helpType.id)) {
        toast({ title: t("scoring.helpAlreadyUsed"), variant: "destructive" });
        return;
      }

      if (isOnline) {
        const { data } = await supabase
          .from("help_usages")
          .insert({
            help_type_id: helpType.id,
            quiz_team_id: teamId,
            quiz_category_id: catId,
            quiz_id: quizId,
            organization_id: currentOrg.id,
          })
          .select()
          .single();
        if (data) setHelpUsages((prev) => [...prev, data as any]);
      } else {
        const localId = enqueueHelpToggle({
          action: "add",
          helpTypeId: helpType.id,
          quizTeamId: teamId,
          quizCategoryId: catId,
          quizId,
          organizationId: currentOrg.id,
        });
        // Optimistic add with local id
        setHelpUsages((prev) => [
          ...prev,
          {
            id: localId,
            help_type_id: helpType.id,
            quiz_team_id: teamId,
            quiz_category_id: catId,
          } as any,
        ]);
      }
    }
  };

  const getTeamTotal = (teamId: string) => {
    let total = 0;
    for (const cat of categories) {
      total += getDisplayPoints(teamId, cat.id);
    }
    return total;
  };

  // Part-based helpers
  const getPartScore = (teamId: string, partId: string) =>
    partScores.find((ps) => ps.quiz_team_id === teamId && ps.quiz_part_id === partId);

  const getPartCategories = (partIdx: number) => {
    if (quizParts.length === 0) return [];
    const part = quizParts[partIdx];
    // Use explicit quiz_part_id assignment if available
    const assigned = categories.filter((c) => c.quiz_part_id === part.id);
    if (assigned.length > 0) return assigned;
    // Fallback: auto-distribute by sort order
    const catsPerPart = Math.ceil(categories.length / quizParts.length);
    const start = partIdx * catsPerPart;
    return categories.slice(start, start + catsPerPart);
  };

  const getPartCategorySum = (teamId: string, partIdx: number) => {
    const partCats = getPartCategories(partIdx);
    return partCats.reduce((sum, cat) => sum + getDisplayPoints(teamId, cat.id), 0);
  };

  const getTeamPartTotal = (teamId: string) => {
    return quizParts.reduce((sum, part) => {
      const ps = getPartScore(teamId, part.id);
      return sum + (ps?.points || 0);
    }, 0);
  };

  const updatePartScore = async (partScoreId: string, value: number) => {
    setPartScores((prev) => prev.map((ps) => (ps.id === partScoreId ? { ...ps, points: value } : ps)));
    if (isOnline) {
      await supabase.from("part_scores").update({ points: value }).eq("id", partScoreId);
    } else {
      enqueueScoreUpdate(partScoreId, "points", value);
    }
  };

  /** Auto-sync part_scores from category display points when drill-down scores change */
  useEffect(() => {
    if (quiz?.scoring_mode !== "per_part" || quizParts.length === 0 || teams.length === 0) return;
    let changed = false;
    const updated = partScores.map((ps) => {
      const partIdx = quizParts.findIndex((p) => p.id === ps.quiz_part_id);
      if (partIdx < 0) return ps;
      const catSum = getPartCategorySum(ps.quiz_team_id, partIdx);
      // Only sync if there are category scores entered (catSum > 0)
      if (catSum > 0 && Math.abs(ps.points - catSum) > 0.001) {
        changed = true;
        // Persist to DB
        if (isOnline) {
          supabase.from("part_scores").update({ points: catSum }).eq("id", ps.id);
        } else {
          enqueueScoreUpdate(ps.id, "points", catSum);
        }
        return { ...ps, points: catSum };
      }
      return ps;
    });
    if (changed) {
      setPartScores(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, helpUsages, categoryBonuses]);

  // Use part totals for ranking when in per_part mode, otherwise use category totals
  const getTeamRankTotal = (teamId: string) => {
    if (quiz?.scoring_mode === "per_part" && quizParts.length > 0) {
      return getTeamPartTotal(teamId);
    }
    return getTeamTotal(teamId);
  };

  const rankedTeams = teams;

  // Check if teams are already sorted by total descending
  const isSortedByTotal = rankedTeams.every((team, idx) => {
    if (idx === 0) return true;
    return getTeamRankTotal(rankedTeams[idx - 1].id) >= getTeamRankTotal(team.id);
  });

  const handleManualSort = () => {
    setTeams((prev) => [...prev].sort((a, b) => getTeamRankTotal(b.id) - getTeamRankTotal(a.id)));
  };

  const handleExport = () => {
    if (!quiz) return;
    // Build help info per team+category
    const helpInfo: Record<string, string[]> = {};
    for (const team of rankedTeams) {
      for (const cat of categories) {
        const key = `${team.id}-${cat.id}`;
        const tags: string[] = [];
        if (jokerType && getHelpUsage(team.id, cat.id, jokerType.id)) tags.push("Joker");
        if (markerType && getHelpUsage(team.id, cat.id, markerType.id)) tags.push("DC");
        if (hasCategoryBonus(team.id, cat.id)) tags.push("Bonus");
        if (tags.length > 0) helpInfo[key] = tags;
      }
    }
    const exportData = {
      quizName: quiz.name,
      quizDate: quiz.date,
      categories: categories.map((c) => (c.category as any)?.name || c.category_id),
      rows: rankedTeams.map((team, idx) => {
        const teamName = (team.team as any)?.name || "";
        const rowScores: Record<string, number> = {};
        const rowHelps: Record<string, string[]> = {};
        for (const cat of categories) {
          const catName = (cat.category as any)?.name || cat.category_id;
          rowScores[catName] = getDisplayPoints(team.id, cat.id);
          const key = `${team.id}-${cat.id}`;
          if (helpInfo[key]) rowHelps[catName] = helpInfo[key];
        }
        return {
          teamName,
          teamAlias: team.alias,
          scores: rowScores,
          helpUsages: rowHelps,
          total: getTeamRankTotal(team.id),
          rank: idx + 1,
        };
      }),
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
      updates.map((u) => supabase.from("quiz_categories").update({ sort_order: u.sort_order }).eq("id", u.id)),
    );
  };

  const updateQuizStatus = async (status: "draft" | "live" | "finished") => {
    if (!quizId) return;
    await supabase.from("quizzes").update({ status }).eq("id", quizId);
    setQuiz((prev) => (prev ? { ...prev, status } : prev));

    if (status === "finished") {
      for (let i = 0; i < rankedTeams.length; i++) {
        const team = rankedTeams[i];
        await supabase
          .from("quiz_teams")
          .update({
            total_points: getTeamRankTotal(team.id),
            rank: i + 1,
          })
          .eq("id", team.id);
      }
    }
    toast({ title: "✓", description: t("scoring.statusUpdated") });
  };

  // Keyboard navigation: arrow keys move between score inputs
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) => {
    let targetRow = rowIdx;
    let targetCol = colIdx;

    if (e.key === "ArrowDown") {
      targetRow = Math.min(rowIdx + 1, rankedTeams.length - 1);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      targetRow = Math.max(rowIdx - 1, 0);
      e.preventDefault();
    } else if (e.key === "ArrowRight" || e.key === "Tab") {
      if (colIdx < categories.length - 1) {
        targetCol = colIdx + 1;
        e.preventDefault();
      } else if (rowIdx < rankedTeams.length - 1) {
        targetRow = rowIdx + 1;
        targetCol = 0;
        e.preventDefault();
      }
    } else if (e.key === "ArrowLeft") {
      if (colIdx > 0) {
        targetCol = colIdx - 1;
        e.preventDefault();
      } else if (rowIdx > 0) {
        targetRow = rowIdx - 1;
        targetCol = categories.length - 1;
        e.preventDefault();
      }
    } else return;

    const key = `${targetRow}-${targetCol}`;
    const el = inputRefs.current.get(key);
    if (el) {
      el.focus();
      el.select();
    }
  };

  const setInputRef = (rowIdx: number, colIdx: number, el: HTMLInputElement | null) => {
    const key = `${rowIdx}-${colIdx}`;
    if (el) inputRefs.current.set(key, el);
    else inputRefs.current.delete(key);
  };

  const getInitials = (name: string) => {
    return name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!quiz) {
    return (
      <DashboardLayout>
        <div className="text-center py-24">
          <p className="text-muted-foreground">{t("scoring.notFound")}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/quizzes")}>
            {t("common.back")}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isDraft = quiz.status === "draft";
  const isLive = quiz.status === "live";
  const isFinished = quiz.status === "finished";
  const canScore = canEdit && isLive; // score editing only when live
  const canReorder = canEdit && isDraft; // reorder only in draft
  const colCount = categories.length;

  // Dynamic sizing: scale fonts/padding based on team count to fit screen
  const teamCount = rankedTeams.length;
  const sizeClass = teamCount <= 6 ? "size-lg" : teamCount <= 10 ? "size-md" : teamCount <= 15 ? "size-sm" : "size-xs";

  return (
    <DashboardLayout>
      <div
        ref={scoringRef}
        className={cn(
          "flex flex-col",
          isFullscreen ? "bg-background p-4 h-screen" : "h-[calc(100vh-6rem)]"
        )}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/quizzes")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">{quiz.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <OfflineIndicator isOnline={isOnline} pendingCount={pendingCount} syncing={syncing} />
            {currentOrg?.logo_url && <img src={currentOrg.logo_url} alt="" className="h-8 w-auto object-contain" />}
            {canReorder && (
              <QuizDraftManager
                quizId={quizId!}
                organizationId={currentOrg!.id}
                quizCategories={categories}
                quizTeams={teams}
                quizParts={quizParts}
                scoringMode={quiz.scoring_mode}
                onChanged={fetchAll}
              />
            )}
            {!isSortedByTotal && (
              <Button variant="outline" size="sm" onClick={handleManualSort} className="gap-1">
                <ChevronDown className="h-4 w-4" /> {t("scoring.sort")}
              </Button>
            )}
            
            <Button variant="outline" size="sm" onClick={toggleFullscreen} className="gap-1">
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
              <Download className="h-4 w-4" /> {t("excel.export")}
            </Button>
            {quiz.scoring_mode === "per_part" && quizParts.length > 0 && (
              <Button
                variant={scoringView === "parts" ? "default" : "outline"}
                size="sm"
                onClick={() => setScoringView(scoringView === "parts" ? "categories" : "parts")}
                className="gap-1"
              >
                <Layers className="h-4 w-4" />
                {scoringView === "parts" ? t("scoring.viewCategories") : t("scoring.viewParts")}
              </Button>
            )}
            {canEdit && quiz.status === "draft" && (
              <Button onClick={() => updateQuizStatus("live")} className="gap-2">
                <Play className="h-4 w-4" /> {t("scoring.goLive")}
              </Button>
            )}
            {canEdit && quiz.status === "live" && (
              <Button onClick={() => updateQuizStatus("finished")} className="gap-2">
                <CheckCircle className="h-4 w-4" /> {t("scoring.finish")}
              </Button>
            )}
            {canEdit && quiz.status === "finished" && (
              <Button onClick={() => updateQuizStatus("live")} variant="outline" className="gap-2">
                <Unlock className="h-4 w-4" /> {t("scoring.reopen")}
              </Button>
            )}
          </div>
        </div>

        {/* Scoring Table */}
        <div
          className="rounded-xl border-2 border-foreground/20 shadow-md overflow-hidden min-h-0 flex-1 mt-2"
          style={{
            backgroundColor: currentOrg?.branding_bg_color || undefined,
            color: currentOrg?.branding_text_color || undefined,
          }}
        >
        {scoringView === "categories" ? (
          (() => {
            const totalCols = categories.length + 2; // team + cats + total
            const colTemplate = `minmax(0,2fr) ${categories.map(() => "minmax(0,1fr)").join(" ")} minmax(0,1fr)`;
            const rowHeight = `calc((100dvh - ${isFullscreen ? 110 : 210}px) / ${Math.max(rankedTeams.length + 1, 1)})`;
            // Dynamic font size for headers based on column count
            const headerFontSize = totalCols <= 5 ? "text-sm" : totalCols <= 8 ? "text-xs" : totalCols <= 12 ? "text-[10px]" : "text-[8px]";
            const teamFontSize = totalCols <= 5 ? "text-base" : totalCols <= 8 ? "text-sm" : totalCols <= 12 ? "text-xs" : "text-[10px]";

            return (
          <div className="h-full w-full flex flex-col">
            {/* Header row */}
            <div
              className="grid w-full border-b-2 border-foreground/20 z-10 bg-card"
              style={{
                gridTemplateColumns: colTemplate,
                height: rowHeight,
                backgroundColor: currentOrg?.branding_header_color || undefined,
              }}
            >
              <div
                className={cn(
                  "p-1 font-bold uppercase tracking-wide flex items-center justify-center text-center overflow-hidden",
                  headerFontSize,
                )}
                style={{ color: currentOrg?.branding_text_color || undefined }}
              >
                {t("scoring.team")}
              </div>
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={cn(
                    "p-0.5 font-bold uppercase tracking-wide text-center border-l-2 border-foreground/20 break-words leading-tight flex items-center justify-center overflow-hidden min-w-0",
                    headerFontSize,
                  )}
                  style={{ color: currentOrg?.branding_text_color || undefined }}
                >
                  {(cat.category as any)?.name || "?"}
                </div>
              ))}
              <div
                className={cn(
                  "p-1 font-bold uppercase tracking-wide text-center border-l-2 border-foreground/20 flex items-center justify-center overflow-hidden",
                  headerFontSize,
                )}
                style={{ color: currentOrg?.branding_text_color || undefined }}
              >
                Σ
              </div>
            </div>

            <div className="flex flex-col flex-1 w-full overflow-hidden">
              {rankedTeams.map((team, rowIdx) => {
                const total = getTeamRankTotal(team.id);
                const teamName = team.alias || (team.team as any)?.name || "";

                return (
                  <div
                    key={team.id}
                    className={cn(
                      "grid w-full border-b-2 border-foreground/20 last:border-0 overflow-hidden",
                      rowIdx === 0 && "bg-primary/[0.04]",
                    )}
                    style={{
                      gridTemplateColumns: colTemplate,
                      height: rowHeight,
                    }}
                  >
                    {/* Rank + Team */}
                    <div className="flex items-center gap-1 p-0.5 overflow-hidden">
                      <div
                        className={cn(
                          "flex-shrink-0 rounded-full bg-foreground/10 flex items-center justify-center font-black text-foreground",
                          teamCount <= 10 ? "w-6 h-6 text-xs" : "w-5 h-5 text-[10px]",
                        )}
                      >
                        {rowIdx + 1}
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        {editingAliasTeamId === team.id ? (
                          <input
                            autoFocus
                            className={cn(
                              "w-full bg-transparent border-b border-primary outline-none font-bold text-foreground",
                              teamFontSize,
                            )}
                            value={editingAliasValue}
                            onChange={(e) => setEditingAliasValue(e.target.value)}
                            onBlur={saveAlias}
                            onKeyDown={handleAliasKeyDown}
                          />
                        ) : (
                          <div
                            className="flex items-center gap-0.5 group cursor-pointer overflow-hidden"
                            onClick={() => canEdit && startEditAlias(team)}
                          >
                            <p
                              className={cn(
                                "font-bold text-foreground truncate leading-tight",
                                teamFontSize,
                              )}
                            >
                              {teamName}
                            </p>
                            {jokerType && hasTeamUsedHelp(team.id, jokerType.id) && (
                              <Zap className="text-primary flex-shrink-0 h-3 w-3" />
                            )}
                            {markerType && hasTeamUsedHelp(team.id, markerType.id) && (
                              <CopyCheck className="text-accent-foreground flex-shrink-0 h-3 w-3" />
                            )}
                            {canEdit && (
                              <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Category scores */}
                    {categories.map((cat, colIdx) => {
                      const score = getScore(team.id, cat.id);
                      const hasJoker = jokerType && getHelpUsage(team.id, cat.id, jokerType.id);
                      const hasMarker = markerType && getHelpUsage(team.id, cat.id, markerType.id);
                      const hasBonusPt = hasCategoryBonus(team.id, cat.id);
                      const displayPts = getDisplayPoints(team.id, cat.id);
                      const catBonusExisting = getCategoryBonus(cat.id);
                      const bonusDisabled = !!catBonusExisting && catBonusExisting.quiz_team_id !== team.id;

                      // Disable help if team already used it in another category OR if the other mutual-exclusive help is active in this cell
                      const jokerDisabledElsewhere = jokerType && !hasJoker && hasTeamUsedHelp(team.id, jokerType.id);
                      const markerDisabledElsewhere =
                        markerType && !hasMarker && hasTeamUsedHelp(team.id, markerType.id);
                      const jokerDisabledByMarker = jokerType && !hasJoker && !!hasMarker;
                      const markerDisabledByJoker = markerType && !hasMarker && !!hasJoker;
                      const jokerDisabled = !!jokerDisabledElsewhere || !!jokerDisabledByMarker;
                      const markerDisabled = !!markerDisabledElsewhere || !!markerDisabledByJoker;

                      return (
                        <div
                          key={cat.id}
                          className={cn(
                            "flex items-stretch border-l-2 border-foreground/20 overflow-hidden",
                            hasJoker && "bg-primary/[0.08]",
                            hasBonusPt && !hasJoker && "bg-yellow-500/[0.06]",
                          )}
                        >
                          {canScore ? (
                            <div className="flex items-center w-full h-full">
                              {/* Help buttons stacked vertically on the left */}
                              {(jokerType || markerType || categoryBonusEnabled) && (
                                <div className="flex flex-col items-center justify-center gap-0.5 px-0.5 flex-shrink-0">
                                  {jokerType && (
                                    <button
                                      onClick={() => toggleHelp(team.id, cat.id, jokerType)}
                                      disabled={jokerDisabled}
                                      tabIndex={-1}
                                      className={cn(
                                        "w-5 h-4 rounded text-[8px] font-black border transition-colors",
                                        hasJoker
                                          ? "bg-primary text-primary-foreground border-primary"
                                          : jokerDisabled
                                            ? "bg-muted text-muted-foreground/40 border-border cursor-not-allowed"
                                            : "bg-background text-foreground/60 border-foreground/20 hover:border-primary hover:text-primary",
                                      )}
                                    >
                                      <Zap className="h-2.5 w-2.5 mx-auto" />
                                    </button>
                                  )}
                                  {markerType && (
                                    <button
                                      onClick={() => toggleHelp(team.id, cat.id, markerType)}
                                      disabled={markerDisabled}
                                      tabIndex={-1}
                                      className={cn(
                                        "w-5 h-4 rounded text-[8px] font-black border transition-colors",
                                        hasMarker
                                          ? "bg-accent text-accent-foreground border-accent"
                                          : markerDisabled
                                            ? "bg-muted text-muted-foreground/40 border-border cursor-not-allowed"
                                            : "bg-background text-foreground/60 border-foreground/20 hover:border-accent hover:text-accent-foreground",
                                      )}
                                    >
                                      <CopyCheck className="h-2.5 w-2.5 mx-auto" />
                                    </button>
                                  )}
                                  {categoryBonusEnabled && (
                                    <button
                                      onClick={() => toggleCategoryBonus(team.id, cat.id)}
                                      disabled={bonusDisabled}
                                      tabIndex={-1}
                                      title={t("scoring.categoryBonus")}
                                      className={cn(
                                        "w-5 h-4 rounded text-[8px] font-black border transition-colors",
                                        hasBonusPt
                                          ? "bg-yellow-500 text-white border-yellow-500"
                                          : bonusDisabled
                                            ? "bg-muted text-muted-foreground/40 border-border cursor-not-allowed"
                                            : "bg-background text-foreground/60 border-foreground/20 hover:border-yellow-500 hover:text-yellow-600",
                                      )}
                                    >
                                      <Crown className="h-2.5 w-2.5 mx-auto" />
                                    </button>
                                  )}
                                </div>
                              )}
                              {/* Score input takes remaining space */}
                              {(() => {
                                const cellKey = `${team.id}-${cat.id}`;
                                const isFocused = focusedCell === cellKey;
                                const showEffective = (hasJoker || hasBonusPt) && !isFocused;
                                const displayValue = showEffective ? displayPts : (score?.points ?? 0);
                                const scoreFontSize = totalCols <= 5 ? "text-3xl" : totalCols <= 8 ? "text-2xl" : totalCols <= 12 ? "text-xl" : "text-base";
                                return (
                                  <input
                                    ref={(el) => setInputRef(rowIdx, colIdx, el)}
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    value={displayValue}
                                    onChange={(e) => score && updateScore(score.id, "points", Number(e.target.value) || 0)}
                                    onFocus={(e) => { setFocusedCell(cellKey); e.target.select(); }}
                                    onBlur={() => setFocusedCell(null)}
                                    onKeyDown={(e) => handleInputKeyDown(e, rowIdx, colIdx)}
                                    tabIndex={rowIdx * colCount + colIdx + 1}
                                    className={cn(
                                      "flex-1 min-w-0 h-full text-center font-black bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors",
                                      showEffective ? "text-primary" : "text-foreground",
                                      scoreFontSize,
                                    )}
                                  />
                                );
                              })()}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center w-full h-full gap-1">
                              {(hasJoker || hasMarker || hasBonusPt) && (
                                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                                  {hasJoker && <Zap className="h-2.5 w-2.5 text-primary" />}
                                  {hasMarker && <CopyCheck className="h-2.5 w-2.5 text-accent-foreground" />}
                                  {hasBonusPt && <Crown className="h-2.5 w-2.5 text-yellow-500" />}
                                </div>
                              )}
                              <p
                                className={cn(
                                  "font-black text-foreground",
                                  totalCols <= 5 ? "text-3xl" : totalCols <= 8 ? "text-2xl" : totalCols <= 12 ? "text-xl" : "text-base",
                                )}
                              >
                                {displayPts % 1 === 0 ? displayPts : displayPts.toFixed(1)}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Total */}
                    <div className="flex items-center justify-center border-l-2 border-foreground/20 overflow-hidden">
                      <span
                        className={cn(
                          "font-black text-primary",
                          totalCols <= 5 ? "text-3xl" : totalCols <= 8 ? "text-2xl" : totalCols <= 12 ? "text-xl" : "text-base",
                        )}
                      >
                        {total % 1 === 0 ? total : total.toFixed(1)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
            );
          })()
        ) : (
          /* Parts-based scoring view */
          (() => {
            const partsColTemplate = `minmax(0,2fr) ${quizParts.map(() => "minmax(0,1fr)").join(" ")} minmax(0,1fr)`;
            const partsRowHeight = `calc((100dvh - ${isFullscreen ? 110 : 210}px) / ${Math.max(rankedTeams.length + 1, 1)})`;

            return (
              <div className="min-h-full w-full flex flex-col">
                {/* Header row */}
                <div
                  className="grid w-full border-b-2 border-foreground/20 sticky top-0 z-10 bg-card"
                  style={{
                    gridTemplateColumns: partsColTemplate,
                    minHeight: partsRowHeight,
                    backgroundColor: currentOrg?.branding_header_color || undefined,
                  }}
                >
                  <div
                    className={cn(
                      "p-1.5 font-bold uppercase tracking-wide flex items-center justify-center text-center",
                      sizeClass === "size-xs" ? "text-[10px]" : "text-xs",
                    )}
                    style={{ color: currentOrg?.branding_text_color || undefined }}
                  >
                    {t("scoring.team")}
                  </div>
                  {quizParts.map((part) => (
                    <div
                      key={part.id}
                      className={cn(
                        "p-1 font-bold uppercase tracking-wide text-center border-l-2 border-foreground/20 break-words leading-tight flex flex-col items-center justify-center cursor-pointer hover:bg-primary/5 transition-colors overflow-hidden min-w-0",
                        sizeClass === "size-xs" ? "text-[8px]" : sizeClass === "size-sm" ? "text-[9px]" : "text-[10px]",
                        expandedPart === part.id && "bg-primary/10",
                      )}
                      style={{ color: currentOrg?.branding_text_color || undefined }}
                      onClick={() => setExpandedPart(expandedPart === part.id ? null : part.id)}
                    >
                      <span>{part.name}</span>
                      {expandedPart === part.id ? (
                        <ChevronUp className="h-3 w-3 mt-0.5 text-primary" />
                      ) : (
                        <ChevronDown className="h-3 w-3 mt-0.5 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                  <div
                    className={cn(
                      "p-1.5 font-bold uppercase tracking-wide text-center border-l-2 border-foreground/20 flex items-center justify-center",
                      sizeClass === "size-xs" ? "text-[10px]" : "text-xs",
                    )}
                    style={{ color: currentOrg?.branding_text_color || undefined }}
                  >
                    Σ
                  </div>
                </div>

                <div className="flex flex-col flex-1 w-full">
                  {rankedTeams.map((team, rowIdx) => {
                    const total = getTeamRankTotal(team.id);
                    const teamName = team.alias || (team.team as any)?.name || "";

                    return (
                      <div
                        key={team.id}
                        className={cn(
                          "grid w-full border-b-2 border-foreground/20 last:border-0",
                          rowIdx === 0 && "bg-primary/[0.04]",
                        )}
                        style={{
                          gridTemplateColumns: partsColTemplate,
                          minHeight: partsRowHeight,
                        }}
                      >
                        {/* Rank + Team */}
                        <div className={cn("flex items-center gap-1.5", sizeClass === "size-xs" ? "p-0.5" : "p-1")}>
                          <div
                            className={cn(
                              "flex-shrink-0 rounded-full bg-foreground/10 flex items-center justify-center font-black text-foreground",
                              sizeClass === "size-lg"
                                ? "w-8 h-8 text-base"
                                : sizeClass === "size-md"
                                  ? "w-7 h-7 text-sm"
                                  : sizeClass === "size-sm"
                                    ? "w-6 h-6 text-xs"
                                    : "w-5 h-5 text-[10px]",
                            )}
                          >
                            {rowIdx + 1}
                          </div>
                          <div className="min-w-0 flex-1 flex items-center gap-1 flex-wrap">
                            <p
                              className={cn(
                                "font-bold text-foreground break-words leading-tight",
                                sizeClass === "size-lg"
                                  ? "text-lg"
                                  : sizeClass === "size-md"
                                    ? "text-md"
                                    : "text-[10px]",
                              )}
                            >
                              {teamName}
                            </p>
                            {jokerType && hasTeamUsedHelp(team.id, jokerType.id) && (
                              <Zap className={cn("text-primary flex-shrink-0", sizeClass === "size-xs" ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} />
                            )}
                            {markerType && hasTeamUsedHelp(team.id, markerType.id) && (
                              <CopyCheck className={cn("text-accent-foreground flex-shrink-0", sizeClass === "size-xs" ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} />
                            )}
                          </div>
                        </div>

                        {/* Part scores */}
                        {quizParts.map((part, partIdx) => {
                          const ps = getPartScore(team.id, part.id);
                          const catSum = getPartCategorySum(team.id, partIdx);
                          const mismatch = ps && ps.points > 0 && catSum > 0 && Math.abs(catSum - ps.points) > 0.01;

                          return (
                            <div
                              key={part.id}
                              className="p-1 flex flex-col items-center justify-center border-l-2 border-foreground/20"
                            >
                              {canScore ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.5}
                                    value={ps?.points ?? 0}
                                    onChange={(e) => ps && updatePartScore(ps.id, Number(e.target.value) || 0)}
                                    onFocus={(e) => e.target.select()}
                                    className={cn(
                                      "w-full text-center font-black bg-transparent border-2 rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors text-foreground border-foreground/15",
                                      sizeClass === "size-lg"
                                        ? "h-14 text-3xl"
                                        : sizeClass === "size-md"
                                          ? "h-10 text-2xl"
                                          : sizeClass === "size-sm"
                                            ? "h-8 text-xl"
                                            : "h-6 text-base",
                                    )}
                                  />
                                  {mismatch && (
                                    <span className="text-[8px] text-destructive font-medium">
                                      ≠ {catSum}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p
                                  className={cn(
                                    "font-black text-foreground",
                                    sizeClass === "size-lg"
                                      ? "text-3xl"
                                      : sizeClass === "size-md"
                                        ? "text-2xl"
                                        : sizeClass === "size-sm"
                                          ? "text-xl"
                                          : "text-base",
                                  )}
                                >
                                  {(ps?.points ?? 0) % 1 === 0 ? (ps?.points ?? 0) : (ps?.points ?? 0).toFixed(1)}
                                </p>
                              )}
                            </div>
                          );
                        })}

                        {/* Total */}
                        <div className="p-1 flex items-center justify-center border-l-2 border-foreground/20">
                          <span
                            className={cn(
                              "font-black text-primary",
                              sizeClass === "size-lg"
                                ? "text-3xl"
                                : sizeClass === "size-md"
                                  ? "text-2xl"
                                  : sizeClass === "size-sm"
                                    ? "text-xl"
                                    : "text-base",
                            )}
                          >
                            {total % 1 === 0 ? total : total.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Expanded part: show categories within that part */}
                {expandedPart && (
                  <div className="border-t-2 border-primary/30 bg-primary/[0.02] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-bold text-primary">
                        {quizParts.find((p) => p.id === expandedPart)?.name} — {t("scoring.expandPart")}
                      </h3>
                      <Button variant="ghost" size="sm" onClick={() => setExpandedPart(null)} className="gap-1 text-xs">
                        {t("scoring.collapsePart")}
                      </Button>
                    </div>
                    {(() => {
                      const partIdx = quizParts.findIndex((p) => p.id === expandedPart);
                      const partCats = getPartCategories(partIdx);
                      if (partCats.length === 0) return <p className="text-xs text-muted-foreground">No categories</p>;

                      return (
                        <div className="overflow-x-auto">
                          <div style={{ minWidth: `${140 + partCats.length * 90 + 70}px` }}>
                            <div
                              className="grid border-b border-foreground/10"
                              style={{ gridTemplateColumns: `140px ${partCats.map(() => "1fr").join(" ")}` }}
                            >
                              <div className="p-1 text-xs font-semibold text-muted-foreground">{t("scoring.team")}</div>
                              {partCats.map((cat) => (
                                <div key={cat.id} className="p-1 text-[10px] font-semibold text-center text-muted-foreground border-l border-foreground/10">
                                  {(cat.category as any)?.name}
                                </div>
                              ))}
                            </div>
                            {rankedTeams.map((team) => {
                              const teamName = team.alias || (team.team as any)?.name || "";
                              return (
                                <div
                                  key={team.id}
                                  className="grid border-b border-foreground/10 last:border-0"
                                  style={{ gridTemplateColumns: `140px ${partCats.map(() => "1fr").join(" ")}` }}
                                >
                                  <div className="p-1 text-xs font-medium truncate">{teamName}</div>
                                  {partCats.map((cat) => {
                                    const score = getScore(team.id, cat.id);
                                    const hasJoker = jokerType && getHelpUsage(team.id, cat.id, jokerType.id);
                                    const hasMarker = markerType && getHelpUsage(team.id, cat.id, markerType.id);
                                    const hasBonusPt = hasCategoryBonus(team.id, cat.id);
                                    const displayPts = getDisplayPoints(team.id, cat.id);
                                    const catBonusExisting = getCategoryBonus(cat.id);
                                    const bonusDisabled = !!catBonusExisting && catBonusExisting.quiz_team_id !== team.id;
                                    const jokerDisabledElsewhere = jokerType && !hasJoker && hasTeamUsedHelp(team.id, jokerType.id);
                                    const markerDisabledElsewhere = markerType && !hasMarker && hasTeamUsedHelp(team.id, markerType.id);
                                    const jokerDisabledByMarker2 = jokerType && !hasJoker && !!hasMarker;
                                    const markerDisabledByJoker2 = markerType && !hasMarker && !!hasJoker;
                                    const jokerDisabled = !!jokerDisabledElsewhere || !!jokerDisabledByMarker2;
                                    const markerDisabled = !!markerDisabledElsewhere || !!markerDisabledByJoker2;

                                    const cellKey = `drill-${team.id}-${cat.id}`;
                                    const isFocused = focusedCell === cellKey;
                                    const showEffective = (hasJoker || hasBonusPt) && !isFocused;
                                    const displayValue = showEffective ? displayPts : (score?.points ?? 0);

                                    return (
                                      <div
                                        key={cat.id}
                                        className={cn(
                                          "p-1 border-l border-foreground/10 flex flex-col items-center gap-0.5",
                                          hasJoker && "bg-primary/[0.08]",
                                          hasBonusPt && !hasJoker && "bg-yellow-500/[0.06]",
                                        )}
                                      >
                                        {canScore ? (
                                          <>
                                            <input
                                              type="number"
                                              min={0}
                                              step={0.5}
                                              value={displayValue}
                                              onChange={(e) => score && updateScore(score.id, "points", Number(e.target.value) || 0)}
                                              onFocus={(e) => { setFocusedCell(cellKey); e.target.select(); }}
                                              onBlur={() => setFocusedCell(null)}
                                              className={cn(
                                                "w-full text-center font-bold text-sm bg-transparent border rounded focus:border-primary focus:outline-none h-7",
                                                showEffective ? "text-primary border-primary/30" : "text-foreground border-foreground/15",
                                              )}
                                            />
                                            <div className="flex items-center gap-0.5">
                                              {jokerType && (
                                                <button
                                                  onClick={() => toggleHelp(team.id, cat.id, jokerType)}
                                                  disabled={jokerDisabled}
                                                  tabIndex={-1}
                                                  className={cn(
                                                    "w-5 h-4 rounded text-[8px] font-black border transition-colors",
                                                    hasJoker
                                                      ? "bg-primary text-primary-foreground border-primary"
                                                      : jokerDisabled
                                                        ? "bg-muted text-muted-foreground/40 border-border cursor-not-allowed"
                                                        : "bg-background text-foreground/60 border-foreground/20 hover:border-primary hover:text-primary",
                                                  )}
                                                >
                                                  <Zap className="h-2.5 w-2.5 mx-auto" />
                                                </button>
                                              )}
                                              {markerType && (
                                                <button
                                                  onClick={() => toggleHelp(team.id, cat.id, markerType)}
                                                  disabled={markerDisabled}
                                                  tabIndex={-1}
                                                  className={cn(
                                                    "w-5 h-4 rounded text-[8px] font-black border transition-colors",
                                                    hasMarker
                                                      ? "bg-accent text-accent-foreground border-accent"
                                                      : markerDisabled
                                                        ? "bg-muted text-muted-foreground/40 border-border cursor-not-allowed"
                                                        : "bg-background text-foreground/60 border-foreground/20 hover:border-accent hover:text-accent-foreground",
                                                  )}
                                                >
                                                  <CopyCheck className="h-2.5 w-2.5 mx-auto" />
                                                </button>
                                              )}
                                              {categoryBonusEnabled && (
                                                <button
                                                  onClick={() => toggleCategoryBonus(team.id, cat.id)}
                                                  disabled={bonusDisabled}
                                                  tabIndex={-1}
                                                  className={cn(
                                                    "w-5 h-4 rounded text-[8px] font-black border transition-colors",
                                                    hasBonusPt
                                                      ? "bg-yellow-500 text-white border-yellow-500"
                                                      : bonusDisabled
                                                        ? "bg-muted text-muted-foreground/40 border-border cursor-not-allowed"
                                                        : "bg-background text-foreground/60 border-foreground/20 hover:border-yellow-500 hover:text-yellow-600",
                                                  )}
                                                >
                                                  <Crown className="h-2.5 w-2.5 mx-auto" />
                                                </button>
                                              )}
                                            </div>
                                          </>
                                        ) : (
                                          <div className="flex flex-col items-center gap-0.5">
                                            <p className="text-sm font-bold text-center">{displayPts % 1 === 0 ? displayPts : displayPts.toFixed(1)}</p>
                                            <div className="flex items-center gap-0.5">
                                              {hasJoker && <Zap className="h-2.5 w-2.5 text-primary" />}
                                              {hasMarker && <CopyCheck className="h-2.5 w-2.5 text-accent-foreground" />}
                                              {hasBonusPt && <Crown className="h-2.5 w-2.5 text-yellow-500" />}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })()
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}
