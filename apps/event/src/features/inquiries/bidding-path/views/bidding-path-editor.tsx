"use client";

import { useEffect, useState } from "react";
import { INQUIRY_BID_STATUSES, parseContract, setInquiryIntakePathSchema, type PrismInquiry } from "@prism/types";
import { biddingPathRepository } from "../data/bidding-path-repository";

type BidStatus = (typeof INQUIRY_BID_STATUSES)[number];
const field = "mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";

/** FR-02: PMCM marks an inquiry that came in as a bid or pitch and tracks the bid apart from the standard path. */
export function BiddingPathEditor({ inquiry }: { inquiry: PrismInquiry }) {
  const [bidding, setBidding] = useState(inquiry.intakePath === "bidding");
  const [status, setStatus] = useState<BidStatus>(inquiry.bidStatus ?? "preparing");
  const [dueAt, setDueAt] = useState(inquiry.bidDueAt?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setBidding(inquiry.intakePath === "bidding");
    setStatus(inquiry.bidStatus ?? "preparing");
    setDueAt(inquiry.bidDueAt?.slice(0, 10) ?? "");
  }, [inquiry.id, inquiry.intakePath, inquiry.bidStatus, inquiry.bidDueAt]);

  async function save(nextBidding: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const input = nextBidding ? { intakePath: "bidding" as const, bidStatus: status, ...(dueAt ? { bidDueAt: dueAt } : {}) } : { intakePath: "standard" as const };
      const saved = await biddingPathRepository.set(inquiry.id, parseContract(setInquiryIntakePathSchema, input, "Inquiry path"));
      setBidding(saved.intakePath === "bidding");
      setMessage(saved.intakePath === "bidding" ? `Bid ${saved.bidStatus}` : "Standard inquiry path");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not save the inquiry path.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-3 text-xs">
      <label className="flex items-center gap-2 font-semibold text-foreground">
        <input type="checkbox" checked={bidding} disabled={busy} onChange={(event) => { setBidding(event.target.checked); if (!event.target.checked) void save(false); }} />
        Bidding path (pitch against other agencies)
      </label>
      {bidding ? (
        <div className="flex flex-wrap items-end gap-2">
          <label>Bid status<select value={status} onChange={(event) => setStatus(event.target.value as BidStatus)} className={field}>{INQUIRY_BID_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Bid due<input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className={field} /></label>
          <button type="button" disabled={busy} onClick={() => void save(true)} className="rounded-md border border-border px-3 py-1.5 font-semibold">{busy ? "Saving…" : "Save bid"}</button>
        </div>
      ) : null}
      {message ? <p role="status" className="text-muted-foreground">{message}</p> : null}
    </div>
  );
}
