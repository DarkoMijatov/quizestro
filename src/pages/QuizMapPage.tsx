import { useTranslation } from 'react-i18next';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ForceDarkTheme } from '@/components/ForceDarkTheme';
import { SEOHead } from '@/components/SEOHead';
import { PublicQuizMap } from '@/components/map/PublicQuizMap';

export default function QuizMapPage() {
  const { t } = useTranslation();

  return (
    <ForceDarkTheme>
      <div className="min-h-screen bg-background flex flex-col">
        <SEOHead
          titleKey="map.title"
          descriptionKey="map.subtitle"
        />
        <Navbar />
        <main className="flex-1 pt-20">
          <div className="container mx-auto px-4 py-8">
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-6 text-center">
              {t('map.title')}
            </h1>
            <p className="text-muted-foreground text-center mb-8 max-w-2xl mx-auto">
              {t('map.subtitle')}
            </p>
          </div>
          <PublicQuizMap />
        </main>
        <Footer />
      </div>
    </ForceDarkTheme>
  );
}
