import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Trophy, Users, FolderOpen, Award, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOrganizations } from '@/hooks/useOrganizations';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { currentOrg, currentRole } = useOrganizations();

  const stats = [
    { label: t('dashboard.quizzes'), value: '0', icon: Trophy, color: 'text-primary' },
    { label: t('dashboard.teams'), value: '0', icon: Users, color: 'text-blue-500' },
    { label: t('dashboard.categories'), value: '0', icon: FolderOpen, color: 'text-emerald-500' },
    { label: t('dashboard.leagues'), value: '0', icon: Award, color: 'text-purple-500' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">{t('dashboard.welcome')} 👋</h1>
            <p className="text-muted-foreground mt-1">
              {currentOrg?.name} · <span className="capitalize">{currentRole}</span>
            </p>
          </div>
          <Link to="/dashboard/quizzes/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t('dashboard.createQuiz')}
            </Button>
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <p className="mt-2 text-3xl font-bold font-display">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Recent quizzes placeholder */}
        <div>
          <h2 className="font-display text-lg font-semibold mb-4">{t('dashboard.recentQuizzes')}</h2>
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{t('dashboard.noQuizzes')}</p>
            <Link to="/dashboard/quizzes/new">
              <Button className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                {t('dashboard.createQuiz')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
