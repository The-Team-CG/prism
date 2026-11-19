"use client";

import { CalendarClock, Lock } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import type { PrismEvent } from "@prism/types";
import { cn } from "@/app/components/ui/utils";
import { clientChangeDeadline } from "./client-change-deadline";

/**
 * One line under the page heading on when the client can still request changes. It is plain text, not a box:
 * amber in the last two weeks and once changes are closed, muted otherwise.
 */
export function ClientChangeDeadlineNotice({ event, todayKey }: { event: PrismEvent; todayKey: string }) {
  const deadline = clientChangeDeadline(event, todayKey);
  if (!deadline) return null;
  const warn = deadline.kind === "closed" || deadline.soon;
  const Icon = deadline.kind === "closed" ? Lock : CalendarClock;
  return (
    <p role="note" className={cn("flex items-start gap-2 text-sm", warn ? "text-attention" : "text-muted-foreground")}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      {deadline.kind === "closed" ? (
        <span>Changes are closed for this event. Any further change needs PMCM to approve an exception.</span>
      ) : (
        <span>
          <span className="font-semibold">
            Change requests close {formatPortalDate(deadline.deadlineAt)} · {deadline.daysLeft === 0 ? "today" : deadline.daysLeft === 1 ? "1 day left" : `${deadline.daysLeft} days left`}
          </span>
          <span className="text-muted-foreground">. After that, a change needs PMCM to approve an exception.</span>
        </span>
      )}
    </p>
  );
}
