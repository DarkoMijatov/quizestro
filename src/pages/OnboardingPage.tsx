import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizations } from "@/hooks/useOrganizations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2, ChevronRight, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function OnboardingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const {
    organizations,
    memberships,
    loading: orgLoading,
    hasFetchedForCurrentUser,
    switchOrg,
    refetch,
  } = useOrganizations();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // If user has orgs and a saved preference, go straight to dashboard
  if (hasFetchedForCurrentUser && organizations.length > 0) {
    const savedOrgId = localStorage.getItem("quizory-current-org");
    // If they have a saved org that still exists, or only 1 org, skip picker
    if (
      organizations.length === 1 ||
      (savedOrgId && organizations.some((o) => o.id === savedOrgId))
    ) {
      return <Navigate to="/dashboard" replace />;
    }
    // Multiple orgs, no saved preference → show picker (handled below)
  }

  const handleSelectOrg = (orgId: string) => {
    switchOrg(orgId);
    navigate("/dashboard");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !orgName.trim()) return;

    setLoading(true);

    // Create org server-side (avoids any client-side RLS edge cases)
    const { data, error } = await supabase.functions.invoke(
      "create-organization",
      {
        body: { name: orgName.trim() },
      },
    );

    const org = (data as any)?.organization as { id: string } | undefined;

    if (error || !org) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create organization",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    localStorage.setItem("quizory-current-org", org.id);
    toast({ title: "✓", description: t("onboarding.success") });
    await refetch();
    navigate("/dashboard");
  };

  const isOwnerOfAny = memberships.some((m) => m.role === "owner");

  // Show org picker if user has multiple orgs without saved preference
  const showPicker = hasFetchedForCurrentUser && organizations.length > 1 && !showCreate;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 font-display font-bold text-xl">
            <img src="/logo.png" alt="Quizestro" className="h-7 w-7 brand-logo" />
            Quizestro
          </div>
          <LanguageSwitcher variant="ghost" />
        </div>

        {showPicker ? (
          <>
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-bold">{t("onboarding.selectOrg")}</h1>
              <p className="text-muted-foreground">{t("onboarding.selectOrgSubtitle")}</p>
            </div>

            <div className="space-y-2">
              {organizations.map((org) => {
                const isOwner = memberships.some(
                  (m) => m.organization_id === org.id && m.role === "owner",
                );
                return (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrg(org.id)}
                    className="w-full flex items-center gap-3 rounded-xl border-2 border-border bg-card p-4 text-left hover:border-primary transition-colors"
                  >
                    {org.logo_url ? (
                      <img
                        src={org.logo_url}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{org.name}</p>
                        {isOwner && (
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                            {t("onboarding.yourOrg", "Vaša")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground capitalize">{org.subscription_tier}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>

            {!isOwnerOfAny && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-4 w-4" />
                {t("onboarding.createNew")}
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-bold">{t("onboarding.title")}</h1>
              <p className="text-muted-foreground">{t("onboarding.subtitle")}</p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">{t("onboarding.orgName")}</Label>
                <Input
                  id="orgName"
                  required
                  maxLength={100}
                  placeholder={t("onboarding.orgNamePlaceholder")}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="text-base"
                  disabled={orgLoading}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading || !orgName.trim() || orgLoading}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("onboarding.cta")}
              </Button>
            </form>

            {organizations.length > 0 && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowCreate(false)}
              >
                {t("common.back")}
              </Button>
            )}

            <p className="text-xs text-center text-muted-foreground">{t("onboarding.note")}</p>
          </>
        )}
      </div>
    </div>
  );
}
