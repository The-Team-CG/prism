import type { PrismEventSchedule, PrismLiveOpsTimer } from '@prism/types';
import { LiveOpsRunSheet } from './live-ops-run-sheet';

export function LiveOpsControlSurface({ eventId, schedule, timer }: { eventId: string; schedule: PrismEventSchedule; timer?: PrismLiveOpsTimer }) {
  return <section className="space-y-4" aria-label="Live command schedule"><header><h2 className="text-xl font-semibold">Live command</h2><p className="text-sm text-muted-foreground">{timer?.label ?? (schedule.authored ? 'Schedule loaded' : 'No schedule authored')}</p></header>{timer && <p className="text-sm" role="status">{timer.status === 'active' ? `${timer.secondsRemaining ?? 0}s remaining` : timer.status === 'complete' ? 'Schedule complete' : `${timer.secondsRemaining ?? 0}s until next segment`}</p>}{schedule.authored ? <LiveOpsRunSheet eventId={eventId} /> : <p className="text-sm text-muted-foreground">No run sheet is available until the schedule is authored.</p>}</section>;
}
