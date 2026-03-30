import { addDays, addWeeks, addMonths, format, startOfDay, isBefore, isAfter } from 'date-fns';

interface ScheduleInput {
  schedule_type: string;
  day_of_week: number | null;
  event_date: string | null;
  start_time: string;
  recurrence_pattern: string;
  valid_from: string | null;
  valid_until: string | null;
}

/**
 * Compute the next occurrence date for a schedule.
 * For one_time events, returns the event_date.
 * For recurring, calculates the next date based on day_of_week, recurrence_pattern, valid_from, valid_until.
 */
export function computeNextDate(schedule: ScheduleInput): Date | null {
  if (schedule.schedule_type === 'one_time' && schedule.event_date) {
    return new Date(schedule.event_date);
  }

  if (schedule.schedule_type !== 'recurring' || schedule.day_of_week === null) {
    return null;
  }

  const today = startOfDay(new Date());
  const validFrom = schedule.valid_from ? startOfDay(new Date(schedule.valid_from)) : null;
  const validUntil = schedule.valid_until ? startOfDay(new Date(schedule.valid_until)) : null;

  // Find the next occurrence of the target day_of_week starting from today (or valid_from if later)
  let searchStart = validFrom && isAfter(validFrom, today) ? validFrom : today;

  // First, find the next day_of_week >= searchStart
  let candidate = new Date(searchStart);
  const targetDay = schedule.day_of_week; // 0=Sunday, 6=Saturday
  const currentDay = candidate.getDay();
  let daysToAdd = (targetDay - currentDay + 7) % 7;
  
  candidate = addDays(candidate, daysToAdd);

  if (schedule.recurrence_pattern === 'weekly') {
    // candidate is already the next occurrence
  } else if (schedule.recurrence_pattern === 'biweekly') {
    // For biweekly, we need an anchor. Use valid_from as anchor if available.
    if (validFrom) {
      // Find first occurrence of target day on or after valid_from
      let anchor = new Date(validFrom);
      const anchorDay = anchor.getDay();
      const anchorDaysToAdd = (targetDay - anchorDay + 7) % 7;
      anchor = addDays(anchor, anchorDaysToAdd);

      // Count weeks between anchor and candidate
      const diffMs = candidate.getTime() - anchor.getTime();
      const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
      if (diffWeeks % 2 !== 0) {
        candidate = addWeeks(candidate, 1);
      }
    }
  } else if (schedule.recurrence_pattern === 'monthly') {
    // Monthly on same day_of_week: find next month's occurrence if candidate is before today
    if (validFrom) {
      let anchor = new Date(validFrom);
      const anchorDay = anchor.getDay();
      const anchorDaysToAdd = (targetDay - anchorDay + 7) % 7;
      anchor = addDays(anchor, anchorDaysToAdd);

      // Walk monthly from anchor until we find one >= today
      let monthCandidate = new Date(anchor);
      while (isBefore(monthCandidate, today)) {
        monthCandidate = addMonths(monthCandidate, 1);
        // Re-align to target day_of_week
        const d = monthCandidate.getDay();
        const adj = (targetDay - d + 7) % 7;
        monthCandidate = addDays(monthCandidate, adj);
      }
      candidate = monthCandidate;
    }
  }

  // Check valid_until
  if (validUntil && isAfter(candidate, validUntil)) {
    return null; // No more occurrences
  }

  return candidate;
}

/**
 * Format a schedule's next occurrence as a readable string.
 */
export function formatNextOccurrence(
  schedule: ScheduleInput,
  t: (key: string) => string,
  dayNameKeys: string[],
  locale?: string
): string {
  const nextDate = computeNextDate(schedule);

  if (schedule.schedule_type === 'one_time' && schedule.event_date) {
    return `${schedule.event_date} ${t('map.at')} ${schedule.start_time.slice(0, 5)}`;
  }

  if (schedule.day_of_week === null) return '';

  const patternSuffix = schedule.recurrence_pattern && schedule.recurrence_pattern !== 'weekly'
    ? ` (${t(`mapSettings.${schedule.recurrence_pattern}`)})`
    : '';

  const dayLabel = t(`map.${dayNameKeys[schedule.day_of_week]}`);
  const timeStr = schedule.start_time.slice(0, 5);

  if (nextDate) {
    const dateStr = format(nextDate, 'dd.MM.yyyy');
    return `${dayLabel} ${t('map.at')} ${timeStr}${patternSuffix} — ${t('map.nextDate') || 'Sledeći'}: ${dateStr}`;
  }

  return `${dayLabel} ${t('map.at')} ${timeStr}${patternSuffix}`;
}
