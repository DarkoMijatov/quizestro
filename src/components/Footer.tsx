import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function Footer() {
  const { t, i18n } = useTranslation();
  const year = new Date().getFullYear();
  const isSr = i18n.language === 'sr';

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-display font-bold text-lg">
          <img src="/logo.png" alt="Quizestro" className="h-6 w-6 brand-logo" />
          Quizestro
        </div>
        <div className="flex flex-col items-center md:items-end gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Link to="/terms" className="hover:text-foreground transition-colors">
              {isSr ? 'Uslovi korišćenja' : 'Terms'}
            </Link>
            <span>·</span>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              {isSr ? 'Privatnost' : 'Privacy'}
            </Link>
            <span>·</span>
            <Link to="/refund" className="hover:text-foreground transition-colors">
              {isSr ? 'Povraćaj sredstava' : 'Refund Policy'}
            </Link>
          </div>
          <p>{t('footer.tagline')} · © {year} Quizestro. {t('footer.rights')}</p>
          <p>
            {t('footer.createdBy')}{' '}
            <a href="https://www.darkmsolutions.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
              DarkM Solutions
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
