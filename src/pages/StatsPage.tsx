import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useOrganizations } from '@/hooks/useOrganizations';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Loader2, Trophy, Users, FolderOpen, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = [
  'hsl(36, 90%, 50%)', 'hsl(220, 70%, 50%)', 'hsl(150, 60%, 45%)',
  'hsl(280, 60%, 55%)', 'hsl(0, 70%, 55%)', 'hsl(190, 70%, 45%)',
  'hsl(45, 80%, 50%)', 'hsl(320, 60%, 50%)',
];

interface QuizByMonth { month: string; count: number }
interface TopTeam { name: string; quizzes: number; avgPoints: number }

export default function StatsPage() {
  const { t } = useTranslation();
  const { currentOrg } = useOrganizations();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ quizzes: 0, teams: 0, categories: 0, leagues: 0 });
  const [quizByMonth, setQuizByMonth] = useState<QuizByMonth[]>([]);
  const [topTeams, setTopTeams] = useState<TopTeam[]>([]);
  const [catDistribution, setCatDistribution] = useState<{ name: string; value: number }[]>([]);

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
      setCounts({ quizzes: q.count || 0, teams: tm.count || 0, categories: c.count || 0, leagues: l.count || 0 });

      // Quizzes by month (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const { data: quizDates } = await supabase
        .from('quizzes')
        .select('date')
        .eq('organization_id', currentOrg.id)
        .gte('date', sixMonthsAgo.toISOString().split('T')[0])
        .order('date');

      if (quizDates && quizDates.length > 0) {
        const monthMap: Record<string, number> = {};
        for (const qd of quizDates) {
          const m = (qd as any).date.substring(0, 7); // YYYY-MM
          monthMap[m] = (monthMap[m] || 0) + 1;
        }
        setQuizByMonth(Object.entries(monthMap).map(([month, count]) => ({ month, count })));
      }

      // Top teams by quiz participation
      const { data: qtData } = await supabase
        .from('quiz_teams')
        .select('team_id, total_points')
        .eq('organization_id', currentOrg.id);

      if (qtData && qtData.length > 0) {
        const teamStats: Record<string, { quizzes: number; totalPoints: number }> = {};
        for (const qt of qtData) {
          const tid = (qt as any).team_id;
          if (!teamStats[tid]) teamStats[tid] = { quizzes: 0, totalPoints: 0 };
          teamStats[tid].quizzes++;
          teamStats[tid].totalPoints += Number((qt as any).total_points) || 0;
        }

        const teamIds = Object.keys(teamStats);
        const { data: teamNames } = await supabase
          .from('teams')
          .select('id, name')
          .in('id', teamIds);

        const nameMap = new Map((teamNames || []).map((t: any) => [t.id, t.name]));
        const sorted = Object.entries(teamStats)
          .map(([id, s]) => ({
            name: nameMap.get(id) || '?',
            quizzes: s.quizzes,
            avgPoints: s.quizzes > 0 ? Math.round((s.totalPoints / s.quizzes) * 10) / 10 : 0,
          }))
          .sort((a, b) => b.quizzes - a.quizzes)
          .slice(0, 8);
        setTopTeams(sorted);
      }

      // Category distribution (how often each category is used)
      const { data: qcData } = await supabase
        .from('quiz_categories')
        .select('category_id')
        .eq('organization_id', currentOrg.id);

      if (qcData && qcData.length > 0) {
        const catCount: Record<string, number> = {};
        for (const qc of qcData) {
          const cid = (qc as any).category_id;
          catCount[cid] = (catCount[cid] || 0) + 1;
        }
        const catIds = Object.keys(catCount);
        const { data: catNames } = await supabase
          .from('categories')
          .select('id, name')
          .in('id', catIds);
        const cNameMap = new Map((catNames || []).map((c: any) => [c.id, c.name]));
        setCatDistribution(
          Object.entries(catCount)
            .map(([id, value]) => ({ name: cNameMap.get(id) || '?', value }))
            .sort((a, b) => b.value - a.value)
        );
      }

      setLoading(false);
    };
    load();
  }, [currentOrg?.id]);

  const cards = [
    { label: t('dashboard.quizzes'), value: counts.quizzes, icon: Trophy, color: 'text-primary' },
    { label: t('dashboard.teams'), value: counts.teams, icon: Users, color: 'text-blue-500' },
    { label: t('dashboard.categories'), value: counts.categories, icon: FolderOpen, color: 'text-emerald-500' },
    { label: t('dashboard.leagues'), value: counts.leagues, icon: Award, color: 'text-purple-500' },
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

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Quizzes by month */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-display font-semibold mb-4">{t('stats.quizzesByMonth')}</h3>
                {quizByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={quizByMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 88%)" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(36, 90%, 50%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">{t('stats.noData')}</p>
                )}
              </div>

              {/* Category distribution pie chart */}
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-display font-semibold mb-4">{t('stats.categoryUsage')}</h3>
                {catDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={catDistribution}
                        cx="50%" cy="50%"
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, value }) => `${name} (${value})`}
                        labelLine={false}
                      >
                        {catDistribution.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">{t('stats.noData')}</p>
                )}
              </div>
            </div>

            {/* Top teams table */}
            {topTeams.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="font-display font-semibold mb-4">{t('stats.topTeams')}</h3>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">#</th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">{t('scoring.team')}</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('stats.quizzesPlayed')}</th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">{t('stats.avgPoints')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topTeams.map((team, i) => (
                        <tr key={team.name} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 px-3 font-bold text-muted-foreground">{i + 1}</td>
                          <td className="py-2.5 px-3 font-medium">{team.name}</td>
                          <td className="py-2.5 px-3 text-right">{team.quizzes}</td>
                          <td className="py-2.5 px-3 text-right font-semibold text-primary">{team.avgPoints}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
