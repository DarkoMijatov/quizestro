import { useTranslation } from 'react-i18next';
import { Wifi, WifiOff, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
}

export function OfflineIndicator({ isOnline, pendingCount, syncing }: OfflineIndicatorProps) {
  const { t } = useTranslation();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors',
        !isOnline
          ? 'bg-destructive/15 text-destructive'
          : syncing
            ? 'bg-primary/15 text-primary'
            : 'bg-green-500/15 text-green-600',
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          <span>
            Offline
            {pendingCount > 0 && ` · ${pendingCount} ${t('offline.pending', 'pending')}`}
          </span>
        </>
      ) : syncing ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>{t('offline.syncing', 'Syncing...')}</span>
        </>
      ) : (
        <>
          <Check className="h-3.5 w-3.5" />
          <span>{t('offline.synced', 'Synced ✓')}</span>
        </>
      )}
    </div>
  );
}
