import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useOrganizations } from '@/hooks/useOrganizations';
import {
  Trophy, LayoutDashboard, Users, FolderOpen, Award,
  BarChart3, Settings, LogOut, BookOpen, UserPlus, ChevronLeft, ChevronRight, Building2, ChevronsUpDown, Lock, Menu, X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentOrg, organizations, switchOrg, currentRole } = useOrganizations();

  const isPremium = currentOrg?.subscription_tier === 'premium' || currentOrg?.subscription_tier === 'trial';

  const navItems = [
    { key: 'dashboard.title', icon: LayoutDashboard, path: '/dashboard' },
    { key: 'dashboard.quizzes', icon: Trophy, path: '/dashboard/quizzes' },
    { key: 'dashboard.teams', icon: Users, path: '/dashboard/teams' },
    { key: 'dashboard.categories', icon: FolderOpen, path: '/dashboard/categories' },
    { key: 'dashboard.leagues', icon: Award, path: '/dashboard/leagues', premium: true },
    { key: 'dashboard.questionBank', icon: BookOpen, path: '/dashboard/questions', premium: true },
    { key: 'dashboard.stats', icon: BarChart3, path: '/dashboard/stats' },
    { key: 'dashboard.members', icon: UserPlus, path: '/dashboard/members' },
    { key: 'dashboard.settings', icon: Settings, path: '/dashboard/settings' },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const renderNav = (isMobile = false) => (
    <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
      {navItems.map((item) => {
        const active = location.pathname === item.path;
        const locked = item.premium && !isPremium;
        return (
          <Link
            key={item.path}
            to={locked ? '#' : item.path}
            onClick={(e) => {
              if (locked) e.preventDefault();
              if (isMobile) setMobileOpen(false);
            }}
          >
            <button className={cn(
              "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              locked
                ? "text-sidebar-foreground/30 cursor-not-allowed"
                : active
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}>
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{t(item.key)}</span>}
              {!collapsed && locked && <Lock className="h-3 w-3 shrink-0" />}
            </button>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className={cn(
        "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}>
        {/* Org switcher */}
        <div className="p-3 border-b border-sidebar-border">
          {!collapsed ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-sidebar-accent transition-colors text-left">
                <Building2 className="h-4 w-4 text-sidebar-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sidebar-foreground truncate">{currentOrg?.name}</p>
                  <p className="text-xs text-sidebar-foreground/60 capitalize">{currentRole}</p>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/50 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {organizations.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => switchOrg(org.id)}
                    className={currentOrg?.id === org.id ? 'bg-accent' : ''}
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    {org.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex justify-center py-2">
              <Building2 className="h-5 w-5 text-sidebar-primary" />
            </div>
          )}
        </div>

        {renderNav()}

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

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 flex flex-col border-r border-sidebar-border bg-sidebar z-10">
            <div className="p-3 border-b border-sidebar-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-sidebar-primary" />
                <span className="text-sm font-medium text-sidebar-foreground truncate">{currentOrg?.name}</span>
              </div>
              <button onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5 text-sidebar-foreground" />
              </button>
            </div>
            {renderNav(true)}
            <div className="p-2 border-t border-sidebar-border space-y-1">
              <LanguageSwitcher variant="ghost" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>{t('nav.logout')}</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <span className="font-display font-bold text-sm">{currentOrg?.name}</span>
          </div>
          <LanguageSwitcher variant="ghost" />
        </div>
        <div className="p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
