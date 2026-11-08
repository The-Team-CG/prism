import { useEffect, useState } from "react";

import type {
  PrismBillingSource,
  PrismBillingStatement,
  PrismCloseGates,
  PrismComplianceCheck,
  PrismComplianceRule,
  PrismEvent,
  PrismEventInsight,
  PrismSupplier,
  PrismSupplierCategory,
  PrismSupplierQuoteRequest,
  CreateSupplierReviewInput,
} from "@prism/types";
import { derivePrismLifecycleStage } from "@prism/types";
import { SupplierReviewPromptList } from "@/features/suppliers/reviews";
import { ComplianceReviewPanel } from "@/features/compliance/review";
import {
  compliancePhaseForStage,
  phase4BillingSourceCard,
  phase4CloseGatesCard,
  phase4ComplianceCard,
  phase4StatementsCard,
  type CloseGateDestination,
  type CompliancePhase,
} from "../model/phase4-workspace-rules";
import {
  money,
  Phase4CloseGatesSection,
  Phase4ClosureBoard,
  Phase4ComplianceSection,
  Phase4InsightsSection,
  ActualEventEndSection,
} from "./phase4-workspace-sections";
import { Phase4SectionBoundary } from "./phase4-section-boundary";
import { EventWrapUpView } from "../../wrap-up";
import { GuestFeedbackQr } from "@/features/closure/guest-feedback-qr/views/guest-feedback-qr";
import { LogisticsBookingsPanel } from "@/features/closure/logistics-bookings/views/logistics-bookings-panel";
import { LogisticsCompletionPanel } from "../../logistics";
import { ClientTestimonialModerationPanel } from "../../wrap-up/views/client-testimonial-moderation-panel";

export type ClosureStep = "wrap-up" | "feedback" | "compliance" | "archive";

export function Phase4Workspace({
  step,
  event,
  rules,
  checks,
  billingSources,
  billingStatements,
  insights,
  supplierCategories,
  suppliers,
  quoteRequests,
  canReviewSuppliers,
  busy,
  onRunCompliance,
  onResolveCompliance,
  onOverrideCompliance,
  onLoadCloseGates,
  onArchive,
  onRecordActualEventEnd,
  onLoadInsights,
  onGenerateInsights,
  onAddReview,
  onOpenDestination,
}: {
  step: ClosureStep;
  event: PrismEvent;
  rules: PrismComplianceRule[];
  checks: PrismComplianceCheck[];
  billingSources: PrismBillingSource[];
  billingStatements: PrismBillingStatement[];
  insights: PrismEventInsight[];
  supplierCategories: PrismSupplierCategory[];
  suppliers: PrismSupplier[];
  quoteRequests: PrismSupplierQuoteRequest[];
  canReviewSuppliers: boolean;
  busy: boolean;
  onRunCompliance: (phase: string) => Promise<void>;
  onResolveCompliance: (checkId: string) => Promise<void>;
  onOverrideCompliance: (checkId: string, reason: string) => Promise<void>;
  onLoadCloseGates: () => Promise<PrismCloseGates>;
  onArchive: (overrideReason?: string) => Promise<void>;
  onRecordActualEventEnd: (input: { actualEndedAt: string; correctionReason?: string }) => Promise<void>;
  onLoadInsights: () => Promise<PrismEventInsight[]>;
  onGenerateInsights: () => Promise<void>;
  onAddReview: (supplierId: string, input: CreateSupplierReviewInput) => Promise<boolean>;
  /** Moves the reviewer to the tab, or event tab, that resolves an unpassed archive gate. */
  onOpenDestination: (destination: CloseGateDestination) => void;
}) {
  const [phase, setPhase] = useState<CompliancePhase>(() => compliancePhaseForStage(derivePrismLifecycleStage(event)));
  const [closeGates, setCloseGates] = useState<PrismCloseGates | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [localInsights, setLocalInsights] = useState<PrismEventInsight[]>(insights);

  useEffect(() => {
    void onLoadCloseGates().then(setCloseGates).catch(() => setCloseGates(null));
    void onLoadInsights().then(setLocalInsights).catch(() => setLocalInsights(insights));
  }, [event.id]);

  useEffect(() => {
    setLocalInsights(insights);
  }, [insights]);

  const approvedSource = billingSources.find((source) => source.status === "approved");
  const latestInsight = localInsights[0];
  const openChecks = checks.filter((check) => check.status === "open");
  const closureCards = [
    phase4CloseGatesCard(closeGates),
    phase4ComplianceCard(openChecks.length, checks.length),
    phase4BillingSourceCard(approvedSource, billingSources.length, (amount) => money.format(amount)),
    phase4StatementsCard(billingStatements.length, Boolean(latestInsight)),
  ];

  async function refreshCloseGates() {
    setCloseGates(await onLoadCloseGates());
  }

  async function archiveEvent() {
    await onArchive(closeGates?.ready ? undefined : overrideReason);
    await refreshCloseGates();
  }

  async function generateInsights() {
    await onGenerateInsights();
    setLocalInsights(await onLoadInsights());
  }

  return (
    <div className="space-y-5">
      <Phase4SectionBoundary title="Closure summary"><Phase4ClosureBoard event={event} closeGates={closeGates} cards={closureCards} /></Phase4SectionBoundary>
      {step === "wrap-up" ? (
        <>
          <Phase4SectionBoundary title="Event end"><ActualEventEndSection event={event} busy={busy} onRecord={onRecordActualEventEnd} /></Phase4SectionBoundary>
          <Phase4SectionBoundary title="Logistics completion"><LogisticsCompletionPanel eventId={event.id} /></Phase4SectionBoundary>
          <Phase4SectionBoundary title="Logistics bookings"><LogisticsBookingsPanel eventId={event.id} eventName={event.eventName} /></Phase4SectionBoundary>
          <Phase4SectionBoundary title="Wrap-up"><EventWrapUpView eventId={event.id} /></Phase4SectionBoundary>
          <Phase4SectionBoundary title="Guest feedback QR"><GuestFeedbackQr accessCode={event.guestAccessCode} /></Phase4SectionBoundary>
        </>
      ) : null}
      {step === "feedback" ? (
        <>
          <Phase4SectionBoundary title="Client testimonials"><ClientTestimonialModerationPanel eventId={event.id} /></Phase4SectionBoundary>
          {canReviewSuppliers ? (
            <Phase4SectionBoundary title="Supplier reviews">
              <SupplierReviewPromptList
                event={event}
                categories={supplierCategories}
                suppliers={suppliers}
                quoteRequests={quoteRequests}
                busy={busy}
                onAddReview={onAddReview}
              />
            </Phase4SectionBoundary>
          ) : null}
        </>
      ) : null}
      {step === "compliance" ? (
        <>
          <Phase4SectionBoundary title="Compliance checks">
            <Phase4ComplianceSection
              phase={phase}
              checks={checks}
              rules={rules}
              openChecks={openChecks}
              busy={busy}
              onPhase={setPhase}
              onRunCompliance={() => onRunCompliance(phase)}
              onResolveCompliance={onResolveCompliance}
              onOverrideCompliance={onOverrideCompliance}
            />
          </Phase4SectionBoundary>
          <Phase4SectionBoundary title="Compliance review"><ComplianceReviewPanel eventId={event.id} /></Phase4SectionBoundary>
        </>
      ) : null}
      {step === "archive" ? (
        <>
          <Phase4SectionBoundary title="Close gates">
            <Phase4CloseGatesSection
              closeGates={closeGates}
              overrideReason={overrideReason}
              busy={busy}
              onOverrideReason={setOverrideReason}
              onRefresh={refreshCloseGates}
              onArchive={archiveEvent}
              onOpenDestination={onOpenDestination}
            />
          </Phase4SectionBoundary>
          <Phase4SectionBoundary title="Post-event insights"><Phase4InsightsSection latestInsight={latestInsight} busy={busy} onGenerate={generateInsights} /></Phase4SectionBoundary>
        </>
      ) : null}
    </div>
  );
}
