"use client";

import { Button } from "@prism/ui/components/button";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { useProposalComments } from "../view-models/use-proposal-comments";

/** FR-60: PMCM reads client comments on the issued proposal and replies in the same thread. */
export function PmcmProposalComments({ eventId }: { eventId: string }) {
  const vm = useProposalComments(eventId);
  return (
    <section className="rounded-lg border border-border bg-card p-5" aria-labelledby="pmcm-proposal-comments-heading">
      <h2 id="pmcm-proposal-comments-heading" className="text-lg font-bold">Proposal comments</h2>
      {vm.error ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}
      <ol className="mt-4 space-y-3">
        {vm.comments.length === 0 ? <li className="text-sm text-muted-foreground">No comments on the issued proposal yet.</li> : null}
        {vm.comments.map((comment) => (
          <li key={comment.id} className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">
              {comment.authorName} ({comment.authorRole === "client" ? "client" : "PMCM"}) · version {comment.proposalVersionNumber} · <time dateTime={comment.createdAt}>{formatPortalDateTime(comment.createdAt)}</time>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
          </li>
        ))}
      </ol>
      <form className="mt-4 grid gap-2" onSubmit={(event) => { event.preventDefault(); void vm.reply(); }}>
        <label className="text-sm font-semibold" htmlFor="pmcm-proposal-reply">Reply to the client</label>
        <textarea id="pmcm-proposal-reply" rows={3} maxLength={2000} value={vm.draft} onChange={(event) => vm.setDraft(event.target.value)} className="rounded-md border border-border bg-background p-3 text-sm" />
        <div><Button type="submit" disabled={vm.busy || !vm.draft.trim()}>{vm.busy ? "Sending…" : "Send reply"}</Button></div>
      </form>
    </section>
  );
}
