"use client";

import { useEffect, useState } from "react";
import { parseContract, updateWalkInPolicySchema, type WalkInPolicy } from "@prism/types";
import { walkInPolicyRepository } from "../data/walk-in-policy-repository";

const OPTIONS: Array<{ value: WalkInPolicy; label: string; help: string }> = [
  { value: "open", label: "Allow walk-ins", help: "Registration staff may add walk-ins, who are verified before check-in." },
  { value: "threshold", label: "Allow walk-ins up to a limit", help: "Walk-ins are accepted until the limit you set." },
  { value: "closed", label: "No walk-ins", help: "Only guests on your list are checked in." },
];

/** New-CL1: the client chooses how walk-in guests are handled; PMCM owns the setting from event day. */
export function ClientWalkInPolicyCard({ eventId }: { eventId: string }) {
  const [policy, setPolicy] = useState<WalkInPolicy>("closed");
  const [threshold, setThreshold] = useState("10");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    walkInPolicyRepository.get(eventId).then((result) => {
      if (!current) return;
      setPolicy(result.policy);
      setThreshold(String(result.threshold || 10));
    }, () => undefined);
    return () => { current = false; };
  }, [eventId]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const input = parseContract(updateWalkInPolicySchema, { policy, ...(policy === "threshold" ? { threshold: Number(threshold) } : {}) }, "Walk-in policy");
      await walkInPolicyRepository.update(eventId, input);
      setMessage("Walk-in policy saved. PMCM and the registration team will follow it.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the walk-in policy.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="client-walk-in-heading">
      <h2 id="client-walk-in-heading" className="text-sm font-bold text-foreground">Walk-in guests</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">For private events under 200 guests. You can change this until event day.</p>
      <fieldset className="mt-3 space-y-2" disabled={saving}>
        <legend className="sr-only">Walk-in policy</legend>
        {OPTIONS.map((option) => (
          <label key={option.value} className="flex items-start gap-2 text-sm">
            <input type="radio" name="walk-in-policy" value={option.value} checked={policy === option.value} onChange={() => setPolicy(option.value)} className="mt-1" />
            <span><span className="font-semibold text-foreground">{option.label}</span><span className="block text-xs text-muted-foreground">{option.help}</span></span>
          </label>
        ))}
        {policy === "threshold" ? (
          <label className="block text-xs font-semibold text-muted-foreground">Walk-in limit
            <input type="number" min={1} value={threshold} onChange={(event) => setThreshold(event.target.value)} className="mt-1 block w-32 rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal text-foreground" />
          </label>
        ) : null}
      </fieldset>
      {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
      {message ? <p aria-live="polite" className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
      <button type="button" onClick={() => void save()} disabled={saving} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : "Save walk-in policy"}</button>
    </section>
  );
}
