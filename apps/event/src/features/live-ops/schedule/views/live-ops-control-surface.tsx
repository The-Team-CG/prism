import type { PrismEventSchedule, PrismLiveOpsTimer } from '@prism/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@prism/ui/components/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@prism/ui/components/empty';
import { LiveOpsRunSheet } from './live-ops-run-sheet';

function timerStatusLine(timer: PrismLiveOpsTimer) {
  if (timer.status === 'active') return `${timer.secondsRemaining ?? 0}s remaining`;
  if (timer.status === 'complete') return 'Schedule complete';
  return `${timer.secondsRemaining ?? 0}s until next segment`;
}

export function LiveOpsControlSurface({ eventId, schedule, timer }: { eventId: string; schedule: PrismEventSchedule; timer?: PrismLiveOpsTimer }) {
  return (
    <section aria-label="Live command schedule">
      <Card>
        <CardHeader>
          <CardTitle>Run window</CardTitle>
          <CardDescription>{timer?.label ?? (schedule.authored ? 'Schedule loaded' : 'No schedule authored')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {timer && schedule.authored ? <p className="text-sm tabular-nums" role="status">{timerStatusLine(timer)}</p> : null}
          {schedule.authored ? (
            <LiveOpsRunSheet eventId={eventId} />
          ) : (
            <Empty className="border-0 p-4 md:p-4">
              <EmptyHeader>
                <EmptyTitle>No run sheet yet</EmptyTitle>
                <EmptyDescription>The run sheet is available once the schedule is authored.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
