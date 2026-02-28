import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Trophy, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const isLanding = location.pathname === '/';

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-light dark:glass">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold">
          <Trophy className="h-6 w-6 text-primary" />
          <span>Quizestro</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-6">
          {isLanding && (
            <>
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {t('nav.features')}
              </a>
              <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                {t('nav.pricing')}
              </a>
            </>
          )}
          <LanguageSwitcher />
          <Link to="/login">
            <Button variant="ghost" size="sm">{t('nav.login')}</Button>
          </Link>
          <Link to="/register">
            <Button size="sm">{t('nav.register')}</Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-lg px-4 py-4 space-y-3">
          {isLanding && (
            <>
              <a href="#features" className="block text-sm font-medium py-2" onClick={() => setOpen(false)}>
                {t('nav.features')}
              </a>
              <a href="#pricing" className="block text-sm font-medium py-2" onClick={() => setOpen(false)}>
                {t('nav.pricing')}
              </a>
            </>
          )}
          <div className="flex items-center gap-2 pt-2">
            <LanguageSwitcher />
          </div>
          <Link to="/login" onClick={() => setOpen(false)}>
            <Button variant="ghost" className="w-full justify-start">{t('nav.login')}</Button>
          </Link>
          <Link to="/register" onClick={() => setOpen(false)}>
            <Button className="w-full">{t('nav.register')}</Button>
          </Link>
        </div>
      )}
    </nav>
  );
}
