"use client";

import { useState } from "react";
import type { PrismBillingStatement, PrismPaymentMilestone } from "@prism/types";
import { billingStatementUrl } from "../data/finance-repository";
import { parseRecordPaymentAmount } from "../model/finance-workspace-rules";
import type { RecordPaymentInput } from "../model/finance-workspace-types";

export type FinancialWorkspaceStatus = "idle" | "editing" | "loading";

export function useFinancialWorkspaceViewModel({
  statement,
  busy = false,
  onRecordPayment,
}: {
  statement?: PrismBillingStatement;
  busy?: boolean;
  onRecordPayment: (milestoneId: string, input: RecordPaymentInput) => Promise<void>;
}) {
  const [activePayment, setActivePayment] = useState<PrismPaymentMilestone | null>(null);
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<RecordPaymentInput["paymentMethod"]>("Bank Transfer");
  const [referenceNumber, setReferenceNumber] = useState("");

  function openRecordModal(payment: PrismPaymentMilestone) {
    setActivePayment(payment);
    setAmountReceived(String(payment.remainingBalance || payment.amount));
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("Bank Transfer");
    setReferenceNumber("");
  }

  async function submitRecordPayment() {
    if (!activePayment) return;
    await onRecordPayment(activePayment.id, {
      amountReceived: parseRecordPaymentAmount(amountReceived),
      paymentDate,
      paymentMethod,
      referenceNumber,
    });
    setActivePayment(null);
  }

  return {
    status: busy ? "loading" : activePayment ? "editing" : "idle",
    activePayment,
    amountReceived,
    paymentDate,
    paymentMethod,
    referenceNumber,
    billingStatementHref: statement?.pdfUrl ? billingStatementUrl(statement.pdfUrl) : undefined,
    openRecordModal,
    submitRecordPayment,
    setActivePayment,
    setAmountReceived,
    setPaymentDate,
    setPaymentMethod,
    setReferenceNumber,
  };
}
