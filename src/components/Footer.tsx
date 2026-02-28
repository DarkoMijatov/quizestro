import { useTranslation } from 'react-i18next';
import { Trophy } from 'lucide-react';

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-display font-bold text-lg">
          <Trophy className="h-5 w-5 text-primary" />
          Kvizorija
        </div>
        <p className="text-sm text-muted-foreground">
          {t('footer.tagline')} · © {year} Kvizorija. {t('footer.rights')}
        </p>
      </div>
    </footer>
  );
}
