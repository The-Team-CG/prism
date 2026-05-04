import { FileCheck2 } from "lucide-react";

import type { MvpInquiry } from "@/lib/mvp-api";
import { PrismSectionPanel, PrismStatusTimeline } from "@prism/ui";
import { compactTimestamp, invitationTone, label } from "./helpers";

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
    <PrismSectionPanel
      title="Client unlock path"
      description="Inquiry acceptance, conforme, invitation, and briefing state"
      icon={FileCheck2}
    >
      <div className="divide-y divide-border">
        {tracked.map((inquiry) => {
          const timeline = [
            {
              id: `${inquiry.id}-accepted`,
              title: "Inquiry accepted",
              status: inquiry.acceptedAt ? "completed" : "pending",
              meta: compactTimestamp(inquiry.acceptedAt),
            },
            {
              id: `${inquiry.id}-sent`,
              title: "Conforme sent",
              status: inquiry.conformeSentAt ? "completed" : "pending",
              meta: compactTimestamp(inquiry.conformeSentAt),
            },
            {
              id: `${inquiry.id}-signed`,
              title: "Conforme signed",
              status: inquiry.conformeSignedAt ? "completed" : "pending",
              meta: compactTimestamp(inquiry.conformeSignedAt),
            },
            {
              id: `${inquiry.id}-portal`,
              title: "Portal activated",
              status: inquiry.portalActivatedAt ? "completed" : "pending",
              meta: compactTimestamp(inquiry.portalActivatedAt),
            },
          ];

          return (
            <article key={inquiry.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-black text-foreground">{inquiry.eventName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {inquiry.clientName} - follow up every {inquiry.followUpIntervalDays ?? 3} days
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ring-1 ${invitationTone(inquiry.portalInvitationStatus)}`}>
                  Invitation {label(inquiry.portalInvitationStatus ?? "not_sent")}
                </span>
              </div>

              <div className="mt-4">
                <PrismStatusTimeline items={timeline} />
              </div>

              {!inquiry.conformeSignedAt ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-l border-primary/20 bg-background/70 px-3 py-2.5">
                  <p className="text-sm text-muted-foreground">
                    {inquiry.reminderDueAt
                      ? `Next reminder due: ${compactTimestamp(inquiry.reminderDueAt)}`
                      : "Reminder schedule starts after conforme is sent."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {inquiry.reminderDue && inquiry.conformeSentAt ? (
                      <button
                        disabled={busy}
                        onClick={() => onSendReminder(inquiry)}
                        className="h-9 rounded-md border border-(--prism-amber)/25 bg-(--prism-amber)/10 px-3 text-xs font-black text-(--prism-amber) disabled:opacity-60"
                      >
                        Send reminder
                      </button>
                    ) : null}
                    <button
                      disabled={busy}
                      onClick={() => onUploadConforme(inquiry)}
                      className="h-9 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60"
                    >
                      Upload signed conforme
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
        {tracked.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
            Accepted inquiries will appear here after PMCM begins onboarding.
          </div>
        ) : null}
      </div>
    </PrismSectionPanel>
  );
}
