import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Loader2, BarChart3, Trophy, Users, FolderOpen, Award } from 'lucide-react';

export default function StatsPage() {
  const { t } = useTranslation();
  const { currentOrg } = useOrganizations();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ quizzes: 0, teams: 0, categories: 0, leagues: 0 });

  useEffect(() => {
    if (!currentOrg) return;
    const load = async () => {
      setLoading(true);
      const [q, tm, c, l] = await Promise.all([
        supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
        supabase.from('teams').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).eq('is_deleted', false),
        supabase.from('categories').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id).eq('is_deleted', false),
        supabase.from('leagues').select('id', { count: 'exact', head: true }).eq('organization_id', currentOrg.id),
      ]);
      setStats({
        quizzes: q.count || 0,
        teams: tm.count || 0,
        categories: c.count || 0,
        leagues: l.count || 0,
      });
      setLoading(false);
    };
    load();
  }, [currentOrg?.id]);

  const cards = [
    { label: t('dashboard.quizzes'), value: stats.quizzes, icon: Trophy, color: 'text-primary' },
    { label: t('dashboard.teams'), value: stats.teams, icon: Users, color: 'text-blue-500' },
    { label: t('dashboard.categories'), value: stats.categories, icon: FolderOpen, color: 'text-emerald-500' },
    { label: t('dashboard.leagues'), value: stats.leagues, icon: Award, color: 'text-purple-500' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold">{t('stats.title')}</h1>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map((c) => (
                <div key={c.label} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{c.label}</span>
                    <c.icon className={`h-5 w-5 ${c.color}`} />
                  </div>
                  <p className="mt-2 text-3xl font-bold font-display">{c.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-card p-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">{t('stats.moreComingSoon')}</p>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
