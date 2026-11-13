"use client";

import { useState } from "react";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";

/** Reject needs a reason the sender will read; the form stays closed until PMCM asks for it. */
export function PmcmRejectForm({ fileName, disabled, onReject }: { fileName: string; disabled: boolean; onReject: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) return <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>Reject</Button>;
  return (
    <form className="flex w-full flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); onReject(reason); }}>
      <Input autoFocus aria-label={`Reason for rejecting ${fileName}`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="What needs to change" className="h-8 min-w-48 flex-1" />
      <Button type="submit" size="sm" variant="destructive" disabled={disabled || !reason.trim()}>Reject</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => { setOpen(false); setReason(""); }}>Cancel</Button>
    </form>
  );
}
