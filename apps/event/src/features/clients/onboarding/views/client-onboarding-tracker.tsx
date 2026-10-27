"use client";

import { CheckCircle2, Circle, FileCheck2 } from "lucide-react";

import type { PrismInquiry } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { compactTimestamp, label } from "@/features/pmcm-kit";
import { onboardingTimelineSteps, reminderEvidenceCopy } from "../model/client-onboarding-rules";
import { usePortalInvitationResendViewModel } from "../view-models/use-portal-invitation-resend-view-model";

function TimelineStep({ title, done, meta }: { title: string; done: boolean; meta?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${done ? "bg-success text-white" : "border-2 border-border bg-background text-muted-foreground"}`}>
        {done ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-bold ${done ? "text-success" : "text-muted-foreground"}`}>{title}</p>
        {meta && <p className="mt-0.5 text-3xs text-muted-foreground">{meta}</p>}
      </div>
    </div>
  );
}

export function ClientOnboardingTracker({
  inquiries,
  onUploadConforme,
  onSendReminder,
  busy,
}: {
  inquiries: PrismInquiry[];
  onUploadConforme: (inquiry: PrismInquiry) => Promise<void>;
  onSendReminder: (inquiry: PrismInquiry) => Promise<void>;
  busy: boolean;
}) {
  const invitations = usePortalInvitationResendViewModel();
  const tracked = inquiries
    .map(invitations.trackedInquiry)
    .filter((inq) => inq.status === "accepted" || Boolean(inq.acceptedAt))
    .sort((a, b) => new Date(b.acceptedAt ?? b.createdAt).getTime() - new Date(a.acceptedAt ?? a.createdAt).getTime());

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Client onboarding</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Conforme, portal invitation, and briefing readiness.
        </p>
      </div>

      {tracked.length === 0 ? (
        <div className="px-6 py-8">
          <EmptyState
            icon={FileCheck2}
            title="No onboarding in progress"
            description="Accepted inquiries will appear here after PMCM begins onboarding."
          />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {tracked.map((inq) => {
            const steps = onboardingTimelineSteps(inq, compactTimestamp);

            return (
              <div key={inq.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{inq.eventName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {inq.clientName} — follow up every {inq.followUpIntervalDays ?? 3} days
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge
                      status={inq.portalInvitationStatus ?? "pending"}
                      label={`Invitation ${label(inq.portalInvitationStatus ?? "not_sent")}`}
                    />
                    {invitations.canResend(inq) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={invitations.busyInquiryId === inq.id}
                        onClick={() => void invitations.resend(inq)}
                        className="rounded-lg font-bold"
                      >
                        {invitations.busyInquiryId === inq.id ? "Sending…" : "Resend invitation"}
                      </Button>
                    )}
                  </div>
                </div>
                {invitations.feedback?.inquiryId === inq.id && (
                  <p role="status" className={`mt-2 text-xs ${invitations.feedback.tone === "error" ? "text-destructive" : "text-success"}`}>
                    {invitations.feedback.text}
                  </p>
                )}

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {steps.map((step) => (
                    <TimelineStep key={step.title} title={step.title} done={step.done} meta={step.meta} />
                  ))}
                </div>

                {!inq.conformeSignedAt && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-attention/20 bg-attention/5 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      {reminderEvidenceCopy(inq, compactTimestamp)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {inq.reminderDue && inq.conformeSentAt && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => onSendReminder(inq)}
                          className="rounded-lg border-attention/25 font-bold text-attention hover:bg-attention/8"
                        >
                          Send reminder
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => onUploadConforme(inq)}
                        className="rounded-lg font-bold"
                      >
                        Upload signed conforme
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
