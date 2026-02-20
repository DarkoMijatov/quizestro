import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import {
  Trophy, LayoutDashboard, Users, FolderOpen, Award,
  BarChart3, Settings, LogOut, BookOpen, UserPlus, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { key: 'dashboard.title', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'dashboard.quizzes', icon: Trophy, path: '/dashboard/quizzes' },
  { key: 'dashboard.teams', icon: Users, path: '/dashboard/teams' },
  { key: 'dashboard.categories', icon: FolderOpen, path: '/dashboard/categories' },
  { key: 'dashboard.leagues', icon: Award, path: '/dashboard/leagues' },
  { key: 'dashboard.questionBank', icon: BookOpen, path: '/dashboard/questions' },
  { key: 'dashboard.stats', icon: BarChart3, path: '/dashboard/stats' },
  { key: 'dashboard.members', icon: UserPlus, path: '/dashboard/members' },
  { key: 'dashboard.settings', icon: Settings, path: '/dashboard/settings' },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}>
        <div className="flex items-center gap-2 p-4 border-b border-sidebar-border">
          <Trophy className="h-6 w-6 text-sidebar-primary shrink-0" />
          {!collapsed && <span className="font-display font-bold text-sidebar-foreground">Quizory</span>}
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}>
                <button className={cn(
                  "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{t(item.key)}</span>}
                </button>
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-sidebar-border space-y-1">
          {!collapsed && <LanguageSwitcher variant="ghost" />}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{t('nav.logout')}</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center rounded-lg py-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
