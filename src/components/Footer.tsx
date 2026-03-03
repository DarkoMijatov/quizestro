import { useTranslation } from 'react-i18next';


export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-display font-bold text-lg">
          <img src="/logo.png" alt="Quizestro" className="h-6 w-6 brand-logo" />
          Quizestro
        </div>
        <div className="text-sm text-muted-foreground text-center md:text-right space-y-1">
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
