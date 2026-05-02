import { FileCheck2 } from "lucide-react";

import type { MvpInquiry } from "@/lib/mvp-api";
import { compactTimestamp, cx, invitationTone, label } from "./helpers";
import { Panel } from "./primitives";

export function ClientOnboardingTracker({
  inquiries,
  onUploadConforme,
  onSendReminder,
  busy,
}: {
  inquiries: MvpInquiry[];
  onUploadConforme: (inquiry: MvpInquiry) => Promise<void>;
  onSendReminder: (inquiry: MvpInquiry) => Promise<void>;
  busy: boolean;
}) {
  const tracked = inquiries
    .filter((inquiry) => inquiry.status === "accepted" || Boolean(inquiry.acceptedAt))
    .sort((a, b) => new Date(b.acceptedAt ?? b.createdAt).getTime() - new Date(a.acceptedAt ?? a.createdAt).getTime());

  return (
    <Panel title="Client Onboarding Tracker" icon={FileCheck2}>
      <div className="space-y-3">
        {tracked.map((inquiry) => {
          const stages = [
            ["Inquiry Accepted", inquiry.acceptedAt],
            ["Conforme Sent", inquiry.conformeSentAt],
            ["Conforme Signed", inquiry.conformeSignedAt],
            ["Portal Activated", inquiry.portalActivatedAt],
          ] as const;

          return (
            <div key={inquiry.id} className="rounded-lg border border-border bg-muted p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-black">{inquiry.eventName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{inquiry.clientName} - follow up every {inquiry.followUpIntervalDays ?? 3} days</p>
                </div>
                <span className={cx("rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1", invitationTone(inquiry.portalInvitationStatus))}>
                  Invitation {label(inquiry.portalInvitationStatus ?? "not_sent")}
                </span>
              </div>
              <div className="mt-4 grid gap-2 lg:grid-cols-4">
                {stages.map(([stage, completedAt]) => (
                  <div key={stage} className={cx("rounded-md border p-3", completedAt ? "border-emerald-200 bg-emerald-50" : "border-border bg-background")}>
                    <p className={cx("text-xs font-black uppercase tracking-wide", completedAt ? "text-emerald-700" : "text-muted-foreground")}>{stage}</p>
                    <p className="mt-2 text-sm font-semibold">{compactTimestamp(completedAt)}</p>
                    {stage === "Conforme Sent" && inquiry.reminderDue && !inquiry.conformeSignedAt && (
                      <button disabled={busy} onClick={() => onSendReminder(inquiry)} className="mt-3 h-8 rounded-md border border-amber-200 bg-amber-50 px-2 text-xs font-black text-amber-800 disabled:opacity-60">
                        Send Reminder
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {!inquiry.conformeSignedAt && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/12 bg-card p-3">
                  <p className="text-sm text-muted-foreground">
                    {inquiry.reminderDueAt ? `Next reminder due: ${compactTimestamp(inquiry.reminderDueAt)}` : "Reminder schedule starts after conforme is sent."}
                  </p>
                  <button disabled={busy} onClick={() => onUploadConforme(inquiry)} className="h-9 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60">
                    Upload signed conforme
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {tracked.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
            Accepted inquiries will appear here after PMCM begins onboarding.
          </div>
        )}
      </div>
    </Panel>
  );
}
