import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/DashboardLayout';
import { BookOpen } from 'lucide-react';

export default function QuestionBankPage() {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="font-display text-2xl font-bold">{t('questionBank.title')}</h1>
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">{t('questionBank.comingSoon')}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
