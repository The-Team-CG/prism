"use client";

import { Plus } from "lucide-react";
import type { PrismEvent } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { PrismStatRow } from "@prism/ui/page-blocks";
import { money } from "@/features/pmcm-kit";
import { usePaymentReceiptsViewModel } from "../view-models/use-payment-receipts-view-model";
import { ReceiptDetailPanel } from "./receipt-detail-panel";
import { ReceiptDialogs } from "./receipt-dialogs";
import { ReceiptList } from "./receipt-list";

/**
 * Money clients paid outside P.R.I.S.M. PMCM finance records it as it arrives, checks it against the statement, and
 * applies it to the milestones it settles. Nothing here moves money; it keeps the ledger true.
 */
export function PaymentReceiptsWorkspace({ events }: { events: PrismEvent[] }) {
  const vm = usePaymentReceiptsViewModel();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PrismStatRow
          label="Receipt totals"
          stats={[
            { label: "Unapplied funds", value: money.format(vm.unappliedTotal), tone: vm.unappliedTotal > 0 ? "attention" : "neutral", detail: "Arrived, not yet applied to a milestone" },
            { label: "Not yet verified", value: vm.needsChecking, empty: vm.needsChecking === 0 },
          ]}
        />
        <Button onClick={() => vm.openDialog({ kind: "record" })} className="rounded-lg font-semibold"><Plus className="size-4" /> Record receipt</Button>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <ReceiptList vm={vm} />
        <ReceiptDetailPanel vm={vm} />
      </div>
      <ReceiptDialogs vm={vm} events={events} />
    </div>
  );
}
