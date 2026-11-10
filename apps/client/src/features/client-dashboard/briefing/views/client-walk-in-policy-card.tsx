"use client";

import { useEffect, useState } from "react";
import { parseContract, updateWalkInPolicySchema, type WalkInPolicy } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { PrismSection } from "@prism/ui/page-blocks";
import { Field, FieldDescription, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { RadioGroup, RadioGroupItem } from "@prism/ui/components/radio-group";
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
    <PrismSection id="client-walk-in-heading" title="Walk-in guests" description="For private events under 200 guests. You can change this until event day.">
      <div className="space-y-4">
        <RadioGroup value={policy} onValueChange={(value) => setPolicy(value as WalkInPolicy)} disabled={saving} aria-label="Walk-in policy">
          {OPTIONS.map((option) => (
            <div key={option.value} className="flex items-start gap-3">
              <RadioGroupItem id={`walk-in-${option.value}`} value={option.value} className="mt-1" />
              <FieldLabel htmlFor={`walk-in-${option.value}`} className="flex flex-col items-start gap-0.5 font-normal">
                <span className="font-semibold text-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.help}</span>
              </FieldLabel>
            </div>
          ))}
        </RadioGroup>
        {policy === "threshold" ? (
          <Field className="max-w-40">
            <FieldLabel htmlFor="walk-in-limit">Walk-in limit</FieldLabel>
            <Input id="walk-in-limit" type="number" min={1} value={threshold} onChange={(event) => setThreshold(event.target.value)} disabled={saving} />
          </Field>
        ) : null}
        {error ? <FieldDescription role="alert" className="text-destructive">{error}</FieldDescription> : null}
        {message ? <FieldDescription aria-live="polite">{message}</FieldDescription> : null}
        <Button type="button" variant="outline" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save walk-in policy"}</Button>
      </div>
    </PrismSection>
  );
}
