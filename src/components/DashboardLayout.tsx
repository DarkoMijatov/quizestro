import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useOrganizations } from '@/hooks/useOrganizations';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Trophy, LayoutDashboard, Users, FolderOpen, Award,
  BarChart3, Settings, LogOut, BookOpen, UserPlus, ChevronLeft, ChevronRight, Building2, ChevronsUpDown, Lock, Menu, X,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Convert hex (#rrggbb) → "h s% l%" HSL string for CSS variables */
function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currentOrg, organizations, switchOrg, currentRole } = useOrganizations();

  const isPremium = currentOrg?.subscription_tier === 'premium' || currentOrg?.subscription_tier === 'trial';

  // Apply theme only inside dashboard (on <html> element)
  useEffect(() => {
    const savedTheme = localStorage.getItem('quizory-theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return () => {
      // When leaving dashboard, revert to light for public pages
      document.documentElement.classList.remove('dark');
    };
  }, []);

  // Apply branding colors as CSS custom properties
  useEffect(() => {
    if (!currentOrg) return;
    const root = document.documentElement;
    if (currentOrg.branding_color) {
      const hsl = hexToHsl(currentOrg.branding_color);
      root.style.setProperty('--primary', hsl);
      root.style.setProperty('--ring', hsl);
      root.style.setProperty('--sidebar-primary', hsl);
      root.style.setProperty('--sidebar-ring', hsl);
      const [h] = hsl.split(' ');
      root.style.setProperty('--accent', `${h} 50% 15%`);
      root.style.setProperty('--accent-foreground', `${h} 80% 65%`);
    }
    if (currentOrg.secondary_color) {
      const hsl = hexToHsl(currentOrg.secondary_color);
      root.style.setProperty('--secondary', hsl.replace(/(\d+)%$/, (_, l) => `${Math.min(Number(l) + 60, 95)}%`));
      root.style.setProperty('--gold-light', hsl);
    }
    return () => {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--sidebar-primary');
      root.style.removeProperty('--sidebar-ring');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-foreground');
      root.style.removeProperty('--secondary');
      root.style.removeProperty('--gold-light');
    };
  }, [currentOrg?.branding_color, currentOrg?.secondary_color]);

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

  const OrgLogo = ({ size = 'sm' }: { size?: 'sm' | 'md' }) => {
    const dim = size === 'sm' ? 'h-5 w-5' : 'h-8 w-8';
    if (currentOrg?.logo_url) {
      return <img src={currentOrg.logo_url} alt="" className={`${dim} rounded object-cover`} />;
    }
    return <Building2 className={`${dim} text-sidebar-primary`} />;
  };

  const renderNavItem = (item: typeof navItems[0], isMobile: boolean) => {
    const active = location.pathname === item.path;
    const locked = item.premium && !isPremium;
    const showLabel = isMobile || !collapsed;
    const label = t(item.key);

    const button = (
      <button className={cn(
        "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        locked
          ? "text-sidebar-foreground/30 cursor-not-allowed"
          : active
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}>
        <item.icon className="h-4 w-4 shrink-0" />
        {showLabel && <span className="flex-1 text-left">{label}</span>}
        {showLabel && locked && <Lock className="h-3 w-3 shrink-0" />}
      </button>
    );

    const link = (
      <Link
        key={item.path}
        to={locked ? '#' : item.path}
        onClick={(e) => {
          if (locked) e.preventDefault();
          if (isMobile) setMobileOpen(false);
        }}
      >
        {button}
      </Link>
    );

    // Show tooltip when sidebar is collapsed (desktop only)
    if (collapsed && !isMobile) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>{link}</TooltipTrigger>
          <TooltipContent side="right">{label}{locked ? ` (${t('common.premium', 'Premium')})` : ''}</TooltipContent>
        </Tooltip>
      );
    }

    return link;
  };

  const renderNav = (isMobile = false) => (
    <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
      {navItems.map((item) => renderNavItem(item, isMobile))}
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
                <OrgLogo size="sm" />
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
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center py-2 cursor-default">
                  <OrgLogo size="sm" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{currentOrg?.name}</TooltipContent>
            </Tooltip>
          )}
        </div>

        {renderNav()}

        <div className="p-2 border-t border-sidebar-border space-y-1">
          {!collapsed && <LanguageSwitcher variant="ghost" />}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('nav.logout')}</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>{t('nav.logout')}</span>
            </button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="w-full flex items-center justify-center rounded-lg py-2 text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
              >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? t('common.expand', 'Expand') : t('common.collapse', 'Collapse')}</TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 flex flex-col border-r border-sidebar-border bg-sidebar z-10">
            <div className="p-3 border-b border-sidebar-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <OrgLogo size="sm" />
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
            {currentOrg?.logo_url && (
              <img src={currentOrg.logo_url} alt="" className="h-6 w-6 rounded object-cover" />
            )}
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
