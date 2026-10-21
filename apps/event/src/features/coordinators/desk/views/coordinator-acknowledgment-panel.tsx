import { useState } from "react";
import { ChevronDown, UserCheck } from "lucide-react";

import type { PrismAcknowledgementReminderResult, PrismCoordinatorAssignment } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { describeReminderResult } from "../model/coordinators-desk-rules";
import { Card, CardBody, CardHeader } from "./coordinator-desk-primitives";

export function PendingAcknowledgmentsPanel({ assignments, busy, onSendReminders }: {
  assignments: PrismCoordinatorAssignment[];
  busy: boolean;
  onSendReminders: () => Promise<PrismAcknowledgementReminderResult | null>;
}) {
  const [open, setOpen] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function sendReminders() {
    setMessage(null);
    setMessage(describeReminderResult(await onSendReminders()));
  }

  if (assignments.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="size-4 text-(--prism-amber)" />
            <h2 className="text-sm font-bold text-foreground">Pending Acknowledgments</h2>
            <span className="rounded-full bg-(--prism-amber)/10 px-2 py-0.5 text-[10px] font-bold text-(--prism-amber)">{assignments.length}</span>
          </div>
          <button
            type="button"
            aria-label={open ? "Collapse pending acknowledgments" : "Expand pending acknowledgments"}
            onClick={() => setOpen((previous) => !previous)}
            className="grid size-7 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted"
          >
            <ChevronDown className={"size-4 transition-transform " + (open ? "rotate-180" : "")} />
          </button>
        </div>
      </CardHeader>
      {open && (
        <CardBody className="space-y-1">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="flex items-center justify-between gap-4 rounded-xl bg-muted/30 px-4 py-2.5">
              <p className="text-sm font-bold text-foreground">{assignment.coordinatorName}</p>
              <span className="rounded-full border border-(--prism-amber)/25 bg-(--prism-amber)/8 px-2 py-0.5 text-[10px] font-bold text-(--prism-amber)">{assignment.role}</span>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Send a reminder to pending coordinators whose event is within seven days.</p>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void sendReminders()}>Send reminders</Button>
          </div>
          {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
        </CardBody>
      )}
    </Card>
  );
}
