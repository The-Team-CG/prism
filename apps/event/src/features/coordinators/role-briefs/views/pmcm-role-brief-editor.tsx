"use client";

import { useEffect, useState } from "react";
import { COORDINATOR_ROLES, canonicalCoordinatorRole, type CoordinatorRole } from "@prism/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { callTimeToLocalInput } from "../model/role-brief-rules";
import { useRoleBriefs, type RoleBriefForm } from "../view-models/use-role-briefs";

const FIELD = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

/** New-CO2: PMCM sets each role's call time, attire, script and instructions for this event. */
export function PmcmRoleBriefEditor({ eventId }: { eventId: string }) {
  const vm = useRoleBriefs(eventId);
  const [role, setRole] = useState<CoordinatorRole>("Floor Director");
  const [form, setForm] = useState<RoleBriefForm>({ callTime: "", attire: "", script: "", instructions: "" });
  const current = vm.briefs.find((brief) => brief.role === role);

  useEffect(() => {
    setForm({
      callTime: callTimeToLocalInput(current?.callTime ?? null),
      attire: current?.attire ?? "",
      script: current?.script ?? "",
      instructions: current?.instructions ?? "",
    });
  }, [current?.callTime, current?.attire, current?.script, current?.instructions, role]);

  const set = (key: keyof RoleBriefForm) => (value: string) => setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="role-brief-heading">
      <h2 id="role-brief-heading" className="text-lg font-semibold">Role briefs</h2>
      <p className="mt-1 text-sm text-muted-foreground">Each assigned coordinator sees only the brief for their own role.</p>
      {vm.error ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void vm.save(role, form); }}>
        <label className="text-sm">Role
          <Select value={role} onValueChange={(value) => { const next = canonicalCoordinatorRole(value); if (next) setRole(next); }}>
            <SelectTrigger aria-label="Role" className="mt-1 w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COORDINATOR_ROLES.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="text-sm">Call time
          <input type="datetime-local" value={form.callTime} onChange={(event) => set("callTime")(event.target.value)} className={FIELD} />
        </label>
        <label className="text-sm md:col-span-2">Attire
          <input value={form.attire} maxLength={500} onChange={(event) => set("attire")(event.target.value)} className={FIELD} />
        </label>
        <label className="text-sm md:col-span-2">Script and cues
          <textarea rows={4} maxLength={8000} value={form.script} onChange={(event) => set("script")(event.target.value)} className={FIELD} />
        </label>
        <label className="text-sm md:col-span-2">Role instructions
          <textarea rows={3} maxLength={4000} value={form.instructions} onChange={(event) => set("instructions")(event.target.value)} className={FIELD} />
        </label>
        <div><button type="submit" disabled={vm.saving || vm.loading} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{vm.saving ? "Saving…" : "Save brief"}</button></div>
      </form>
    </section>
  );
}
