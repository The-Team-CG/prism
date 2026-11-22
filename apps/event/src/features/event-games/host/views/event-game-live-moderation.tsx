"use client";

import { useState } from "react";
import type { PrismGameHostState } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";

type FamilyFeudAnswerBoard = NonNullable<PrismGameHostState["currentRound"]>["answerBoard"];

export function FamilyFeudAdjudicationQueue({
  sessionId,
  answerBoard,
  answers,
  busy,
  onResolve,
}: {
  sessionId: string;
  answerBoard: FamilyFeudAnswerBoard;
  answers: NonNullable<PrismGameHostState["currentRound"]>["pendingAnswers"];
  busy: boolean;
  onResolve: (sessionId: string, submissionId: string, boardAnswer: string | null) => Promise<unknown>;
}) {
  if (!answers || !answerBoard) return null;
  return <section className="mb-4 rounded-md border border-border bg-background p-4" aria-label="Family Feud answer review">
    <h4 className="font-bold">Review answers awaiting a score</h4>
    <p className="mt-1 text-xs text-muted-foreground">Choose the matching configured board answer to award its points, or choose No award. Points come from the saved board.</p>
    {answers.length ? <ul className="mt-3 grid gap-3">
      {answers.map((submission) => <li key={submission.id} className="rounded-md border border-border p-3">
        <p className="text-sm font-semibold">{submission.answer}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {answerBoard.map((boardAnswer) => <Button
            key={boardAnswer.answer}
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void onResolve(sessionId, submission.id, boardAnswer.answer)}
          >Award {boardAnswer.answer} · {boardAnswer.points} points</Button>)}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void onResolve(sessionId, submission.id, null)}
          >No award</Button>
        </div>
      </li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No answers are waiting for review.</p>}
  </section>;
}

export function SplitResponseModerationQueue({
  sessionId,
  submissions,
  busy,
  onModerate,
}: {
  sessionId: string;
  submissions: NonNullable<PrismGameHostState["currentRound"]>["pendingSubmissions"];
  busy: boolean;
  onModerate: (
    sessionId: string,
    submissionId: string,
    action: "approve_submission" | "hide_submission",
    reason?: string,
  ) => Promise<unknown>;
}) {
  if (!submissions) return null;
  return <section className="mb-4 rounded-md border border-border bg-background p-4" aria-label="Split the Room response moderation">
    <h4 className="font-bold">Review participant responses</h4>
    <p className="mt-1 text-xs text-muted-foreground">Only approved responses can be shown to guests after the round is paused.</p>
    {submissions.length ? (
      <ul className="mt-3 grid gap-3">
        {submissions.map((submission) => <PendingSplitResponseRow
          key={submission.id}
          sessionId={sessionId}
          submission={submission}
          busy={busy}
          onModerate={onModerate}
        />)}
      </ul>
    ) : <p className="mt-3 text-sm text-muted-foreground">No responses are waiting for review.</p>}
  </section>;
}

function PendingSplitResponseRow({
  sessionId,
  submission,
  busy,
  onModerate,
}: {
  sessionId: string;
  submission: NonNullable<PrismGameHostState["currentRound"]>["pendingSubmissions"] extends readonly (infer T)[] | undefined ? T : never;
  busy: boolean;
  onModerate: (
    sessionId: string,
    submissionId: string,
    action: "approve_submission" | "hide_submission",
    reason?: string,
  ) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  return <li className="rounded-md border border-border bg-card p-3">
    <p className="whitespace-pre-wrap text-sm">{submission.response}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={busy}
        onClick={() => void onModerate(sessionId, submission.id, "approve_submission")}>
        Approve for reveal
      </Button>
      <label className="sr-only" htmlFor={`split-hide-reason-${submission.id}`}>Reason for hiding response</label>
      <Input id={`split-hide-reason-${submission.id}`} value={reason} onChange={(event) => setReason(event.target.value)}
        maxLength={500} placeholder="Reason to hide" className="h-8 w-auto min-w-48" />
      <Button type="button" size="sm" variant="outline" disabled={busy || !reason.trim()}
        onClick={() => void onModerate(sessionId, submission.id, "hide_submission", reason.trim())}>
        Hide
      </Button>
    </div>
  </li>;
}
