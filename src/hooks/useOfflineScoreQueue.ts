import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from './useOnlineStatus';
import { toast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScoreUpdate {
  type: 'score';
  scoreId: string;
  field: 'points' | 'bonus_points';
  value: number;
  timestamp: number;
}

interface HelpToggle {
  type: 'help_toggle';
  action: 'add' | 'remove';
  // For remove
  helpUsageId?: string;
  // For add
  helpTypeId?: string;
  quizTeamId?: string;
  quizCategoryId?: string;
  quizId?: string;
  organizationId?: string;
  timestamp: number;
  /** Optimistic local id so we can match state */
  localId: string;
}

interface CategoryBonusToggle {
  type: 'category_bonus';
  action: 'set' | 'remove';
  // For remove — delete by quiz_category_id (unique per quiz)
  quizCategoryId: string;
  // For set
  quizTeamId?: string;
  quizId?: string;
  organizationId?: string;
  /** If switching from another team, old record id to delete first */
  previousId?: string;
  timestamp: number;
  localId: string;
}

type QueueItem = ScoreUpdate | HelpToggle | CategoryBonusToggle;

const STORAGE_KEY_PREFIX = 'quizory-offline-queue-';

function getStorageKey(quizId: string) {
  return `${STORAGE_KEY_PREFIX}${quizId}`;
}

function loadQueue(quizId: string): QueueItem[] {
  try {
    const raw = localStorage.getItem(getStorageKey(quizId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(quizId: string, queue: QueueItem[]) {
  if (queue.length === 0) {
    localStorage.removeItem(getStorageKey(quizId));
  } else {
    localStorage.setItem(getStorageKey(quizId), JSON.stringify(queue));
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseOfflineScoreQueueOptions {
  quizId: string | undefined;
  /** Called when sync completes so the page can refetch fresh data */
  onSynced?: () => void;
}

export function useOfflineScoreQueue({ quizId, onSynced }: UseOfflineScoreQueueOptions) {
  const isOnline = useOnlineStatus();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  // Load queue from storage on mount
  useEffect(() => {
    if (quizId) setQueue(loadQueue(quizId));
  }, [quizId]);

  // Persist queue changes
  useEffect(() => {
    if (quizId) saveQueue(quizId, queue);
  }, [queue, quizId]);

  // ── Enqueue helpers ──

  const enqueueScoreUpdate = useCallback(
    (scoreId: string, field: 'points' | 'bonus_points', value: number) => {
      setQueue((prev) => {
        // Dedupe: replace existing update for same scoreId+field
        const filtered = prev.filter(
          (item) => !(item.type === 'score' && (item as ScoreUpdate).scoreId === scoreId && (item as ScoreUpdate).field === field),
        );
        return [...filtered, { type: 'score', scoreId, field, value, timestamp: Date.now() }];
      });
    },
    [],
  );

  const enqueueHelpToggle = useCallback(
    (item: Omit<HelpToggle, 'type' | 'timestamp' | 'localId'>) => {
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: HelpToggle = { ...item, type: 'help_toggle', timestamp: Date.now(), localId };
      setQueue((prev) => [...prev, entry]);
      return localId;
    },
    [],
  );

  const enqueueCategoryBonus = useCallback(
    (item: Omit<CategoryBonusToggle, 'type' | 'timestamp' | 'localId'>) => {
      const localId = `local-cb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: CategoryBonusToggle = { ...item, type: 'category_bonus', timestamp: Date.now(), localId };
      setQueue((prev) => {
        // Dedupe: replace existing category_bonus for same quizCategoryId
        const filtered = prev.filter(
          (i) => !(i.type === 'category_bonus' && (i as CategoryBonusToggle).quizCategoryId === item.quizCategoryId),
        );
        return [...filtered, entry];
      });
      return localId;
    },
    [],
  );

  // ── Sync logic ──

  const flushQueue = useCallback(async () => {
    if (!quizId || syncingRef.current) return;
    const pending = loadQueue(quizId);
    if (pending.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);

    // Sort by timestamp to preserve order
    pending.sort((a, b) => a.timestamp - b.timestamp);

    const failed: QueueItem[] = [];

    for (const item of pending) {
      try {
        if (item.type === 'score') {
          const s = item as ScoreUpdate;
          const { error } = await supabase.from('scores').update({ [s.field]: s.value }).eq('id', s.scoreId);
          if (error) throw error;
        } else if (item.type === 'help_toggle') {
          const h = item as HelpToggle;
          if (h.action === 'remove' && h.helpUsageId) {
            const { error } = await supabase.from('help_usages').delete().eq('id', h.helpUsageId);
            if (error) throw error;
          } else if (h.action === 'add') {
            const { error } = await supabase.from('help_usages').insert({
              help_type_id: h.helpTypeId!,
              quiz_team_id: h.quizTeamId!,
              quiz_category_id: h.quizCategoryId!,
              quiz_id: h.quizId!,
              organization_id: h.organizationId!,
            });
            if (error) throw error;
          }
        } else if (item.type === 'category_bonus') {
          const cb = item as CategoryBonusToggle;
          if (cb.action === 'remove') {
            // Delete by quiz_category_id (unique constraint ensures one per category)
            const { error } = await supabase
              .from('category_bonuses')
              .delete()
              .eq('quiz_category_id', cb.quizCategoryId)
              .eq('quiz_id', quizId);
            if (error) throw error;
          } else if (cb.action === 'set') {
            // First remove any existing for this category
            if (cb.previousId) {
              await supabase.from('category_bonuses').delete().eq('id', cb.previousId);
            }
            const { error } = await supabase.from('category_bonuses').insert({
              quiz_id: cb.quizId!,
              quiz_category_id: cb.quizCategoryId,
              quiz_team_id: cb.quizTeamId!,
              organization_id: cb.organizationId!,
            });
            if (error) throw error;
          }
        }
      } catch (err) {
        console.warn('[offline-queue] failed to sync item, will retry', item, err);
        failed.push(item);
      }
    }

    // Update queue with only failed items
    setQueue(failed);
    saveQueue(quizId, failed);
    syncingRef.current = false;
    setSyncing(false);

    if (failed.length === 0) {
      toast({
        title: 'Sinhronizovano ✓',
        description: `Svi offline podaci su uspešno sačuvani.`,
      });
      onSynced?.();
    }
  }, [quizId, onSynced]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0 && !syncingRef.current) {
      flushQueue();
    }
  }, [isOnline, queue.length, flushQueue]);

  return {
    isOnline,
    pendingCount: queue.length,
    syncing,
    enqueueScoreUpdate,
    enqueueHelpToggle,
    enqueueCategoryBonus,
    flushQueue,
  };
}
