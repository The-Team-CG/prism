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
import { SupplierReviewPromptList } from "@/features/suppliers/reviews";
import { ComplianceReviewPanel } from "@/features/compliance/review";
import {
  phase4BillingSourceCard,
  phase4CloseGatesCard,
  phase4ComplianceCard,
  phase4RuleLayer,
  phase4StatementsCard,
} from "../model/phase4-workspace-rules";
import {
  money,
  Phase4BillingSection,
  Phase4CloseGatesSection,
  Phase4ClosureBoard,
  Phase4ComplianceSection,
  Phase4InsightsSection,
  ActualEventEndSection,
} from "./phase4-workspace-sections";
import { EventWrapUpView } from "../../wrap-up";
import { ClientTestimonialModerationPanel } from "../../wrap-up/views/client-testimonial-moderation-panel";

export function Phase4Workspace({
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
  onCreateRule,
  onRunCompliance,
  onResolveCompliance,
  onOverrideCompliance,
  onCreateBillingSource,
  onApproveBillingSource,
  onGenerateBillingStatement,
  onLoadCloseGates,
  onArchive,
  onRecordActualEventEnd,
  onLoadInsights,
  onGenerateInsights,
  onAddReview,
}: {
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
  onCreateRule: (input: {
    title: string;
    conditionKey: string;
    phase: string;
    severity: string;
    layer: string;
    note: string;
  }) => Promise<void>;
  onRunCompliance: (phase: string) => Promise<void>;
  onResolveCompliance: (checkId: string) => Promise<void>;
  onOverrideCompliance: (checkId: string, reason: string) => Promise<void>;
  onCreateBillingSource: (input: {
    sourceLabel: string;
    lineItems: Array<{ label: string; amount: number }>;
    paymentSchedule: Array<{ label: string; percentage: number }>;
  }) => Promise<void>;
  onApproveBillingSource: (sourceId: string) => Promise<void>;
  onGenerateBillingStatement: (sourceId: string) => Promise<void>;
  onLoadCloseGates: () => Promise<PrismCloseGates>;
  onArchive: (overrideReason?: string) => Promise<void>;
  onRecordActualEventEnd: (input: { actualEndedAt: string; correctionReason?: string }) => Promise<void>;
  onLoadInsights: () => Promise<PrismEventInsight[]>;
  onGenerateInsights: () => Promise<void>;
  onAddReview: (supplierId: string, input: CreateSupplierReviewInput) => Promise<boolean>;
}) {
  const [phase, setPhase] = useState("planning");
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleKey, setRuleKey] = useState("");
  const [ruleSeverity, setRuleSeverity] = useState("must_fix");
  const [ruleNote, setRuleNote] = useState("");
  const [billingLabel, setBillingLabel] = useState(`${event.eventName} approved CE`);
  const [lineLabel, setLineLabel] = useState("Approved event package");
  const [lineAmount, setLineAmount] = useState("520000");
  const [closeGates, setCloseGates] = useState<PrismCloseGates | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [localInsights, setLocalInsights] = useState<PrismEventInsight[]>(insights);

  useEffect(() => {
    setBillingLabel(`${event.eventName} approved CE`);
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

  async function createRule() {
    await onCreateRule({
      title: ruleTitle,
      conditionKey: ruleKey,
      phase,
      severity: ruleSeverity,
      layer: phase4RuleLayer(ruleSeverity),
      note: ruleNote,
    });
    setRuleTitle("");
    setRuleKey("");
    setRuleNote("");
  }

  async function createBillingSource() {
    await onCreateBillingSource({
      sourceLabel: billingLabel,
      lineItems: [{ label: lineLabel, amount: Number(lineAmount) }],
      paymentSchedule: [
        { label: "Downpayment", percentage: 50 },
        { label: "Balance", percentage: 50 },
      ],
    });
  }

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
      <Phase4ClosureBoard event={event} closeGates={closeGates} cards={closureCards} />
      <ActualEventEndSection event={event} busy={busy} onRecord={onRecordActualEventEnd} />
      <EventWrapUpView eventId={event.id} />
      <ClientTestimonialModerationPanel eventId={event.id} />
      <Phase4ComplianceSection
        phase={phase}
        ruleTitle={ruleTitle}
        ruleKey={ruleKey}
        ruleSeverity={ruleSeverity}
        ruleNote={ruleNote}
        checks={checks}
        rules={rules}
        openChecks={openChecks}
        busy={busy}
        onPhase={setPhase}
        onRuleTitle={setRuleTitle}
        onRuleKey={setRuleKey}
        onRuleSeverity={setRuleSeverity}
        onRuleNote={setRuleNote}
        onCreateRule={createRule}
        onRunCompliance={() => onRunCompliance(phase)}
        onResolveCompliance={onResolveCompliance}
        onOverrideCompliance={onOverrideCompliance}
      />
      <ComplianceReviewPanel eventId={event.id} />
      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Phase4BillingSection
          billingLabel={billingLabel}
          lineLabel={lineLabel}
          lineAmount={lineAmount}
          billingSources={billingSources}
          billingStatements={billingStatements}
          approvedSource={approvedSource}
          busy={busy}
          onBillingLabel={setBillingLabel}
          onLineLabel={setLineLabel}
          onLineAmount={setLineAmount}
          onCreate={createBillingSource}
          onApprove={onApproveBillingSource}
          onGenerate={onGenerateBillingStatement}
        />
        <Phase4CloseGatesSection
          closeGates={closeGates}
          overrideReason={overrideReason}
          busy={busy}
          onOverrideReason={setOverrideReason}
          onRefresh={refreshCloseGates}
          onArchive={archiveEvent}
        />
      </section>
      {canReviewSuppliers ? (
        <SupplierReviewPromptList
          event={event}
          categories={supplierCategories}
          suppliers={suppliers}
          quoteRequests={quoteRequests}
          busy={busy}
          onAddReview={onAddReview}
        />
      ) : null}
      <Phase4InsightsSection latestInsight={latestInsight} busy={busy} onGenerate={generateInsights} />
    </div>
  );
}
