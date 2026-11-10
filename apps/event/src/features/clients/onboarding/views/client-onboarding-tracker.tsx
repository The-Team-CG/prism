"use client";

import { CheckCircle2, Circle, FileCheck2 } from "lucide-react";

import type { PrismInquiry } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { compactTimestamp, label } from "@/features/pmcm-kit";
import { onboardingTimelineSteps, reminderEvidenceCopy } from "../model/client-onboarding-rules";
import { usePortalInvitationResendViewModel } from "../view-models/use-portal-invitation-resend-view-model";
import { Card } from "@prism/ui/components/card";

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

/** FR-02: bids are tracked apart from the standard onboarding path. */
function BiddingPathList({ inquiries }: { inquiries: PrismInquiry[] }) {
  const bids = inquiries.filter((inquiry) => inquiry.intakePath === "bidding");
  if (bids.length === 0) return null;
  return (
    <div className="border-b border-border px-6 py-4">
      <p className="text-xs font-bold text-foreground">Bidding path ({bids.length})</p>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {bids.map((bid) => (
          <li key={bid.id}><span className="font-semibold text-foreground">{bid.eventName}</span> · {bid.clientName} · bid {bid.bidStatus ?? "preparing"}{bid.bidDueAt ? ` · due ${compactTimestamp(bid.bidDueAt)}` : ""}</li>
        ))}
      </ul>
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
    <Card className="gap-0 block rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Client onboarding</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Conforme, portal invitation, and briefing readiness.
        </p>
      </div>

      <BiddingPathList inquiries={inquiries} />
      {tracked.length === 0 ? (
        <div className="px-6 py-8">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileCheck2 />
              </EmptyMedia>
              <EmptyTitle>No onboarding in progress</EmptyTitle>
              <EmptyDescription>Accepted inquiries will appear here after PMCM begins onboarding.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {tracked.map((inq) => {
            const steps = onboardingTimelineSteps(inq, compactTimestamp);

            return (
              <article key={inq.id} aria-label={`Onboarding ${inq.eventName}`} className="px-6 py-4">
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
              </article>
            );
          })}
        </div>
      )}
    </Card>
  );
}
