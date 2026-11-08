"use client";

import type { ClientMessageTrigger } from "@prism/types";
import { useClientFollowUps } from "../view-models/use-client-follow-ups";

const TITLES: Record<ClientMessageTrigger, string> = {
  proposal_unanswered: "Proposal waiting for the client",
  balance_due: "Balance payment due soon",
  floorplan_pending: "Floor plan waiting for approval",
};
const FIELD = "mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

/** FR-AI-09: follow-ups that apply now. AI drafts; PMCM edits and sends; nothing goes out automatically. */
export function PmcmClientFollowUps({ eventId }: { eventId: string }) {
  const vm = useClientFollowUps(eventId);
  return (
    <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="client-follow-ups-heading">
      <h2 id="client-follow-ups-heading" className="text-lg font-bold">Client follow-ups</h2>
      <p className="mt-1 text-sm text-muted-foreground">Suggested when a proposal waits 3 days, a balance is due within 48 hours, or a floor plan waits 2 days for approval.</p>
      {vm.error ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}
      {vm.notice ? <p aria-live="polite" className="mt-3 text-sm text-muted-foreground">{vm.notice}</p> : null}
      {vm.triggers.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No follow-ups are due for this event.</p> : null}
      <ul className="mt-4 space-y-4">
        {vm.triggers.map((item) => {
          const draft = vm.drafts[item.trigger];
          const busy = vm.busy === item.trigger;
          return (
            <li key={item.trigger} className="rounded-md border border-border p-4">
              <p className="font-semibold">{TITLES[item.trigger]}</p>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
              {draft ? (
                <form className="mt-3 grid gap-2" onSubmit={(event) => { event.preventDefault(); void vm.send(item.trigger); }}>
                  <label className="text-sm">Subject<input value={draft.subject} maxLength={150} onChange={(event) => vm.edit(item.trigger, { subject: event.target.value })} className={FIELD} /></label>
                  <label className="text-sm">Message<textarea rows={5} maxLength={2000} value={draft.body} onChange={(event) => vm.edit(item.trigger, { body: event.target.value })} className={FIELD} /></label>
                  <div><button type="submit" disabled={busy || !draft.subject.trim() || !draft.body.trim()} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Sending…" : "Send to client"}</button></div>
                </form>
              ) : (
                <button type="button" disabled={busy} onClick={() => void vm.draft(item.trigger)} className="mt-3 rounded-md border border-border px-3 py-2 text-sm font-semibold disabled:opacity-50">{busy ? "Drafting…" : "Draft with AI"}</button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
