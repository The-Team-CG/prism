"use client";

import { formatPortalDateTime } from "@prism/ui/format-date";
import { Card } from "@prism/ui/components/card";
import { useProposalComments } from "../view-models/use-proposal-comments";

/** FR-60: comments on the issued proposal. Commenting never approves or requests a revision. */
export function ProposalCommentsThread({ eventId, enabled }: { eventId: string; enabled: boolean }) {
  const vm = useProposalComments(eventId, enabled);
  if (!enabled) return null;
  return (
    <Card role="region" className="gap-3 p-5" aria-labelledby="proposal-comments-heading">
      <h2 id="proposal-comments-heading" className="text-lg font-semibold">Proposal comments</h2>
      <p className="mt-1 text-sm text-muted-foreground">Ask PMCM about the proposal. Comments do not approve it or use a revision round.</p>
      {vm.error ? <p role="alert" className="mt-3 text-sm text-destructive">{vm.error}</p> : null}
      <ol className="mt-4 space-y-3">
        {vm.comments.length === 0 ? <li className="text-sm text-muted-foreground">No comments yet.</li> : null}
        {vm.comments.map((comment) => (
          <li key={comment.id} className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">
              {comment.authorRole === "client" ? comment.authorName : "PMCM"} · version {comment.proposalVersionNumber} · <time dateTime={comment.createdAt}>{formatPortalDateTime(comment.createdAt)}</time>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
          </li>
        ))}
      </ol>
      <form className="mt-4 grid gap-2" onSubmit={(event) => { event.preventDefault(); void vm.send(); }}>
        <label className="text-sm font-semibold" htmlFor="proposal-comment">Add a comment</label>
        <textarea id="proposal-comment" rows={3} maxLength={2000} value={vm.draft} onChange={(event) => vm.setDraft(event.target.value)} className="rounded-md border border-border bg-background p-3 text-sm" />
        <div><button type="submit" disabled={vm.busy || !vm.draft.trim()} className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{vm.busy ? "Sending…" : "Send comment"}</button></div>
      </form>
    </Card>
  );
}
