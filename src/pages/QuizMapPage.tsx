import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { ForceDarkTheme } from '@/components/ForceDarkTheme';
import { SEOHead } from '@/components/SEOHead';
import { PublicQuizMap } from '@/components/map/PublicQuizMap';

export default function QuizMapPage() {
  return (
    <ForceDarkTheme>
      <div className="min-h-screen bg-background flex flex-col">
        <SEOHead
          titleKey="map.title"
          descriptionKey="map.subtitle"
        />
        <Navbar />
        <main className="flex-1 pt-20">
          <PublicQuizMap />
        </main>
        <Footer />
      </div>
    </ForceDarkTheme>
  );
}
