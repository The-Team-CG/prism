"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { PrismGuestQrPassIssueResult, PrismGuestQrPassStatus } from "@prism/types";
import { guestQrPassDeliveryLabel } from "../model/guest-qr-rules";

export type GuestQrPassActionsProps = {
  rosterEntryId: string;
  pass: PrismGuestQrPassStatus | null;
  canIssue: boolean;
  disabled: boolean;
  onIssue: () => Promise<PrismGuestQrPassIssueResult | null>;
  onRetry: (passId: string) => Promise<PrismGuestQrPassStatus | null>;
  onReissue: (passId: string) => Promise<PrismGuestQrPassIssueResult | null>;
  onRevoke: (passId: string) => Promise<PrismGuestQrPassStatus | null>;
  onRefresh: () => Promise<void>;
};

export function GuestQrPassActionsView({
  rosterEntryId,
  pass,
  canIssue,
  disabled,
  onIssue,
  onRetry,
  onReissue,
  onRevoke,
  onRefresh,
}: GuestQrPassActionsProps) {
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<"reissue" | "revoke" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrPass, setQrPass] = useState<PrismGuestQrPassStatus | null>(null);
  const qrValue = useRef<string | null>(null);
  const qrDialogTitleId = `guest-qr-dialog-title-${rosterEntryId}`;
  const confirmTitleId = `guest-qr-confirm-title-${rosterEntryId}`;

  useEffect(() => () => {
    qrValue.current = null;
  }, []);

  function showQr(result: PrismGuestQrPassIssueResult) {
    qrValue.current = result.qrValue;
    setQrPass(result.pass);
    setQrOpen(true);
  }

  function closeQr() {
    qrValue.current = null;
    setQrPass(null);
    setQrOpen(false);
  }

  async function issue() {
    setActionBusy(true);
    setMessage(null);
    try {
      const result = await onIssue();
      if (!result) {
        setMessage("Unable to issue a guest QR pass.");
        return;
      }
      showQr(result);
      await onRefresh();
    } catch {
      setMessage("Unable to issue a guest QR pass.");
    } finally {
      setActionBusy(false);
    }
  }

  async function retry() {
    if (!pass) return;
    setActionBusy(true);
    setMessage(null);
    try {
      const result = await onRetry(pass.id);
      if (!result) setMessage("Unable to retry guest pass delivery.");
      else await onRefresh();
    } catch {
      setMessage("Unable to retry guest pass delivery.");
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmPassAction() {
    if (!pass || !confirmation) return;
    const action = confirmation;
    setActionBusy(true);
    setMessage(null);
    try {
      if (action === "reissue") {
        const result = await onReissue(pass.id);
        if (!result) {
          setMessage("Unable to reissue this guest QR pass.");
          return;
        }
        showQr(result);
        await onRefresh();
      } else {
        const result = await onRevoke(pass.id);
        if (!result) {
          setMessage("Unable to revoke this guest QR pass.");
          return;
        }
        if (qrPass?.id === pass.id) closeQr();
        await onRefresh();
      }
    } catch {
      setMessage(action === "reissue" ? "Unable to reissue this guest QR pass." : "Unable to revoke this guest QR pass.");
    } finally {
      setActionBusy(false);
      setConfirmation(null);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {pass ? (
        <span className="text-xs text-muted-foreground">
          QR pass {pass.status === "active" ? "active" : "revoked"} · {guestQrPassDeliveryLabel(pass.deliveryStatus)}
        </span>
      ) : null}
      {!pass || pass.status === "revoked" ? (canIssue ? (
        <button type="button" disabled={disabled || actionBusy} onClick={() => void issue()} className="rounded-md border border-border px-3 py-1.5 text-xs font-bold">
          {pass ? "Issue new QR pass" : "Issue QR pass"}
        </button>
      ) : null) : null}
      {pass?.status === "active" && canIssue ? (
        <>
          {pass.deliveryStatus === "queued" ? (
            <button type="button" disabled={disabled || actionBusy} onClick={() => void retry()} className="rounded-md border border-border px-3 py-1.5 text-xs font-bold">
              Retry delivery
            </button>
          ) : null}
          <button type="button" disabled={disabled || actionBusy} onClick={() => setConfirmation("reissue")} className="rounded-md border border-border px-3 py-1.5 text-xs font-bold">
            Reissue QR pass
          </button>
        </>
      ) : null}
      {pass?.status === "active" ? (
        <button type="button" disabled={disabled || actionBusy} onClick={() => setConfirmation("revoke")} className="rounded-md border border-border px-3 py-1.5 text-xs font-bold">
          Revoke QR pass
        </button>
      ) : null}
      {message ? <span role="alert" className="text-xs text-destructive">{message}</span> : null}
      {confirmation ? (
        <div role="alertdialog" aria-modal="true" aria-labelledby={confirmTitleId} className="basis-full rounded-md border border-border bg-background p-3">
          <p id={confirmTitleId} className="text-sm font-semibold">
            {confirmation === "reissue" ? "Reissue this guest QR pass?" : "Revoke this guest QR pass?"} The old QR will stop working immediately.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={actionBusy} onClick={() => void confirmPassAction()} className="rounded-md bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
              {confirmation === "reissue" ? "Confirm reissue" : "Confirm revoke"}
            </button>
            <button type="button" disabled={actionBusy} onClick={() => setConfirmation(null)} className="rounded-md border border-border px-3 py-2 text-xs font-bold">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {qrOpen && qrValue.current ? (
        <div role="dialog" aria-modal="true" aria-labelledby={qrDialogTitleId} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 text-center shadow-xl">
            <h3 id={qrDialogTitleId} className="text-lg font-bold">One-time guest QR pass</h3>
            <div className="mx-auto my-5 grid size-64 place-items-center rounded-md bg-white p-3">
              <QRCodeSVG value={qrValue.current} size={232} title="One-time guest QR pass" role="img" aria-label="One-time guest QR pass" />
            </div>
            {qrPass ? <p className="text-sm text-muted-foreground">{guestQrPassDeliveryLabel(qrPass.deliveryStatus)}</p> : null}
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Show this QR to the guest now. The pass value is available only in this view.</p>
            <button type="button" onClick={closeQr} className="mt-5 min-h-10 rounded-md border border-border px-4 py-2 text-sm font-bold">
              Close QR
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
