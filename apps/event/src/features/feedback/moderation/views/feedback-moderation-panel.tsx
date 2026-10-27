"use client";

import { useState } from "react";
import { useFeedbackModerationViewModel } from "../view-models/use-feedback-moderation-view-model";

export function FeedbackModerationPanel({ eventId }: { eventId: string }) {
  const vm = useFeedbackModerationViewModel(eventId);
  return <section className="rounded-lg border border-border bg-card p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-attention">Guest feedback</p><h2 className="mt-1 text-xl font-black">Moderation queue</h2><p className="mt-1 text-sm text-muted-foreground">Only pending feedback appears here. Approved content must retain consent.</p></div><span className="text-sm font-bold text-muted-foreground">{vm.feedback.length} pending</span></div>
    {vm.error ? <p className="mt-4 text-sm text-destructive">{vm.error}</p> : null}
    <div className="mt-5 space-y-3">{vm.feedback.map((item) => <ModerationRow key={item.id} item={item} busy={vm.busyId === item.id} onDecide={vm.decide} />)}</div>
    {vm.feedback.length === 0 && !vm.error ? <p className="mt-5 rounded-md border border-dashed border-border p-5 text-sm text-muted-foreground">No feedback is waiting for review.</p> : null}
  </section>;
}

function ModerationRow({ item, busy, onDecide }: { item: import("@prism/types").PrismGuestFeedback; busy: boolean; onDecide: (id: string, action: "approve" | "reject" | "hide", reason?: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  return <article className="rounded-md border border-border bg-background p-4"><div className="flex justify-between gap-3"><div><p className="font-bold">{item.guestName} · {item.rating}/5</p><p className="mt-1 text-sm text-muted-foreground">{item.comment || "No comment"}</p></div><span className="text-xs font-bold text-muted-foreground">{item.moderationStatus}</span></div><div className="mt-3 flex flex-wrap gap-2"><input className="min-w-56 flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason for reject or hide" /><button disabled={busy} onClick={() => void onDecide(item.id, "approve")} className="rounded-md bg-success px-3 py-2 text-sm font-bold text-white">Approve</button><button disabled={busy || !reason.trim()} onClick={() => void onDecide(item.id, "reject", reason)} className="rounded-md border border-border px-3 py-2 text-sm font-bold">Reject</button><button disabled={busy || !reason.trim()} onClick={() => void onDecide(item.id, "hide", reason)} className="rounded-md border border-border px-3 py-2 text-sm font-bold">Hide</button></div></article>;
}
