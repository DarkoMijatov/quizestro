import { DashboardLayout } from '@/components/DashboardLayout';
import { LocationManager } from '@/components/map/LocationManager';
import { useTranslation } from 'react-i18next';

export default function QuizLocationsPage() {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold">{t('dashboard.quizLocations')}</h1>
        <LocationManager />
      </div>
    </DashboardLayout>
  );
}
