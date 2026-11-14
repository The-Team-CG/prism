"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { CreateBillingSourceInput, PrismBillingSource, PrismBillingStatement, PrismDocument } from "@prism/types";
import { BillingSourcePanel } from "@/features/finance/billing-source/views/billing-source-panel";
import { BillingWordTemplate } from "@/features/finance/billing-template/views/billing-word-template";
import { usePaymentDetailsReady } from "@/features/finance/payment-details";

const MISSING = "Add your payment details first, so clients know where to pay.";

/** The billing sources of one event, with a warning and a link when PMCM has no payment details to print on a statement. */
export function BillingSourcesTab({ eventId, eventName, billingSources, statements, proposalDocuments, busy, onCreate, onApprove, onGenerate }: {
  eventId: string;
  eventName: string;
  billingSources: PrismBillingSource[];
  statements: PrismBillingStatement[];
  proposalDocuments: PrismDocument[];
  busy: boolean;
  onCreate: (input: CreateBillingSourceInput) => Promise<boolean>;
  onApprove: (sourceId: string) => Promise<void>;
  onGenerate: (sourceId: string) => Promise<void>;
}) {
  const ready = usePaymentDetailsReady();
  return (
    <div className="space-y-5">
      {ready === false ? (
        <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-attention/40 bg-attention-soft px-4 py-3 text-sm text-attention">
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 basis-56">No payment details are turned on, so a statement cannot be issued yet.</span>
          <Link href="/dashboard/finance/payment-details" className="font-semibold underline-offset-2 hover:underline">Add payment details</Link>
        </p>
      ) : null}
      <BillingSourcePanel
        key={eventId}
        eventName={eventName}
        billingSources={billingSources}
        statements={statements}
        proposalDocuments={proposalDocuments}
        busy={busy}
        generateBlockedReason={ready === false ? MISSING : null}
        onCreate={onCreate}
        onApprove={onApprove}
        onGenerate={onGenerate}
      />
      <BillingWordTemplate statement={statements.find((statement) => statement.eventId === eventId && statement.status !== "superseded")} />
    </div>
  );
}
