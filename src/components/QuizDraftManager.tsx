import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, X, Search, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Category {
  id: string;
  name: string;
}
interface Team {
  id: string;
  name: string;
}

interface QuizCategory {
  id: string;
  category_id: string;
  sort_order: number | null;
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

interface Props {
  quizId: string;
  organizationId: string;
  quizCategories: QuizCategory[];
  quizTeams: QuizTeam[];
  onChanged: () => void;
}

export function QuizDraftManager({ quizId, organizationId, quizCategories, quizTeams, onChanged }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [catSearch, setCatSearch] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingCat, setCreatingCat] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const [catRes, teamRes] = await Promise.all([
        supabase
          .from("categories")
          .select("id, name")
          .eq("organization_id", organizationId)
          .eq("is_deleted", false)
          .order("id"),
        supabase
          .from("teams")
          .select("id, name")
          .eq("organization_id", organizationId)
          .eq("is_deleted", false)
          .order("name"),
      ]);
      setAllCategories((catRes.data as Category[]) || []);
      setAllTeams((teamRes.data as Team[]) || []);
    };
    load();
  }, [open, organizationId]);

  const usedCatIds = new Set(quizCategories.map((c) => c.category_id));
  const usedTeamIds = new Set(quizTeams.map((t) => t.team_id));

  const availableCats = allCategories.filter((c) => !usedCatIds.has(c.id));
  const filteredCats = catSearch.trim()
    ? availableCats.filter((c) => c.name.toLowerCase().includes(catSearch.toLowerCase()))
    : availableCats;
  const catSearchNoResults = catSearch.trim().length > 0 && filteredCats.length === 0;

  const availableTeams = allTeams.filter((t) => !usedTeamIds.has(t.id));
  const filteredTeams = teamSearch.trim()
    ? availableTeams.filter((t) => t.name.toLowerCase().includes(teamSearch.toLowerCase()))
    : availableTeams;
  const teamSearchNoResults = teamSearch.trim().length > 0 && filteredTeams.length === 0;

  const createAndAddCategory = async () => {
    if (!catSearch.trim()) return;
    setCreatingCat(true);
    const { data } = await supabase
      .from("categories")
      .insert({
        name: catSearch.trim(),
        organization_id: organizationId,
      })
      .select()
      .single();
    if (data) {
      const newCat = data as Category;
      setAllCategories((prev) => [...prev, newCat]);
      setCatSearch("");
      await addCategory(newCat.id);
    }
    setCreatingCat(false);
  };

  const createAndAddTeam = async () => {
    if (!teamSearch.trim()) return;
    setCreatingTeam(true);
    const { data } = await supabase
      .from("teams")
      .insert({
        name: teamSearch.trim(),
        organization_id: organizationId,
      })
      .select()
      .single();
    if (data) {
      const newTeam = data as Team;
      setAllTeams((prev) => [...prev, newTeam]);
      setTeamSearch("");
      await addTeam(newTeam.id);
    }
    setCreatingTeam(false);
  };

  const addCategory = async (catId: string) => {
    setLoading(true);
    const sortOrder = quizCategories.length;
    const { data: qc } = await supabase
      .from("quiz_categories")
      .insert({
        quiz_id: quizId,
        category_id: catId,
        organization_id: organizationId,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (qc) {
      // Create score rows for all existing teams
      const scoreInserts = quizTeams.map((qt) => ({
        quiz_id: quizId,
        quiz_team_id: qt.id,
        quiz_category_id: (qc as any).id,
        organization_id: organizationId,
        points: 0,
        bonus_points: 0,
      }));
      if (scoreInserts.length > 0) {
        await supabase.from("scores").insert(scoreInserts);
      }
    }

    toast({ title: "✓", description: t("quiz.categoryAdded") });
    setLoading(false);
    onChanged();
  };

  const removeCategory = async (quizCatId: string) => {
    setLoading(true);
    // Delete scores for this category
    await supabase.from("scores").delete().eq("quiz_category_id", quizCatId).eq("quiz_id", quizId);
    // Delete help_usages for this category
    await supabase.from("help_usages").delete().eq("quiz_category_id", quizCatId).eq("quiz_id", quizId);
    // Delete the quiz_category
    await supabase.from("quiz_categories").delete().eq("id", quizCatId);

    toast({ title: "✓" });
    setLoading(false);
    onChanged();
  };

  const addTeam = async (teamId: string) => {
    setLoading(true);
    const team = allTeams.find((t) => t.id === teamId);
    const { data: qt } = await supabase
      .from("quiz_teams")
      .insert({
        quiz_id: quizId,
        team_id: teamId,
        organization_id: organizationId,
        alias: team?.name || null,
      })
      .select()
      .single();

    if (qt) {
      // Create score rows for all existing categories
      const scoreInserts = quizCategories.map((qc) => ({
        quiz_id: quizId,
        quiz_team_id: (qt as any).id,
        quiz_category_id: qc.id,
        organization_id: organizationId,
        points: 0,
        bonus_points: 0,
      }));
      if (scoreInserts.length > 0) {
        await supabase.from("scores").insert(scoreInserts);
      }
    }

    toast({ title: "✓", description: t("quiz.teamAdded") });
    setLoading(false);
    onChanged();
  };

  const removeTeam = async (quizTeamId: string) => {
    setLoading(true);
    // Delete scores for this team
    await supabase.from("scores").delete().eq("quiz_team_id", quizTeamId).eq("quiz_id", quizId);
    // Delete help_usages for this team
    await supabase.from("help_usages").delete().eq("quiz_team_id", quizTeamId).eq("quiz_id", quizId);
    // Delete the quiz_team
    await supabase.from("quiz_teams").delete().eq("id", quizTeamId);

    toast({ title: "✓" });
    setLoading(false);
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Settings2 className="h-4 w-4" /> {t("scoring.manageDraft")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("scoring.manageDraft")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Categories */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">{t("dashboard.categories")}</h3>

            {/* Current categories */}
            <div className="space-y-1">
              {quizCategories.map((qc) => (
                <div
                  key={qc.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm"
                >
                  <span>{(qc.category as any)?.name}</span>
                  <button
                    onClick={() => removeCategory(qc.id)}
                    disabled={loading || quizCategories.length <= 1}
                    className="text-destructive hover:text-destructive/80 disabled:opacity-30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add categories */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                placeholder={t("quiz.searchCategories")}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {filteredCats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addCategory(c.id)}
                  disabled={loading}
                  className="w-full flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary transition-colors text-left"
                >
                  <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                  {c.name}
                </button>
              ))}
              {catSearchNoResults && (
                <button
                  onClick={createAndAddCategory}
                  disabled={creatingCat || loading}
                  className="w-full flex items-center gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 transition-colors text-left"
                >
                  <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                  {t("quiz.createCategoryPrompt", { name: catSearch.trim() })}
                </button>
              )}
              {filteredCats.length === 0 && !catSearchNoResults && (
                <p className="text-xs text-muted-foreground text-center py-2">{t("common.noResults")}</p>
              )}
            </div>
          </div>

          {/* Teams */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">{t("dashboard.teams")}</h3>

            {/* Current teams */}
            <div className="space-y-1">
              {quizTeams.map((qt) => (
                <div
                  key={qt.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm"
                >
                  <span>{qt.alias || (qt.team as any)?.name}</span>
                  <button
                    onClick={() => removeTeam(qt.id)}
                    disabled={loading || quizTeams.length <= 2}
                    className="text-destructive hover:text-destructive/80 disabled:opacity-30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add teams */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder={t("quiz.searchTeams")}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {filteredTeams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => addTeam(t.id)}
                  disabled={loading}
                  className="w-full flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm hover:border-primary hover:text-primary transition-colors text-left"
                >
                  <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                  {t.name}
                </button>
              ))}
              {teamSearchNoResults && (
                <button
                  onClick={createAndAddTeam}
                  disabled={creatingTeam || loading}
                  className="w-full flex items-center gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 transition-colors text-left"
                >
                  <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                  {t("quiz.createTeamPrompt", { name: teamSearch.trim() })}
                </button>
              )}
              {filteredTeams.length === 0 && !teamSearchNoResults && (
                <p className="text-xs text-muted-foreground text-center py-2">{t("common.noResults")}</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
