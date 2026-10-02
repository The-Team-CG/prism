import { useCallback, useEffect, useState } from 'react';
import type { PrismEventSchedule } from '@prism/types';
import { loadLiveOpsSchedule } from '../use-cases/load-live-ops-schedule';

export function useLiveOpsScheduleViewModel(eventId: string) {
  const [schedule, setSchedule] = useState<PrismEventSchedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try { setError(null); setSchedule(await loadLiveOpsSchedule(eventId)); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }, [eventId]);
  useEffect(() => { void reload(); }, [reload]);
  return { schedule, error, reload };
}
