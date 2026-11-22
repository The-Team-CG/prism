"use client";

import { useState } from "react";
import type { PrismGameSessionResponse } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Card, CardBody, CardHeader } from "@/features/event-dashboard/shell/views/sections/shell-ui";
import type { useEventGamesHostViewModel } from "../view-models/use-event-games-host-view-model";
import { InlineError } from "./event-games-host-sections";

function responseText(response: PrismGameSessionResponse["response"]): string {
  return typeof response === "string" ? response : JSON.stringify(response);
}

export function ResponseReviewSection({
  sessionId,
  sessions,
  responses,
  hasMore,
  busy,
  readOnly,
  onSessionChange,
  onLoad,
  onLoadMore,
  onModerate,
  error,
}: {
  sessionId: string;
  sessions: NonNullable<ReturnType<typeof useEventGamesHostViewModel>["analytics"]>["sessions"];
  responses: PrismGameSessionResponse[];
  hasMore: boolean;
  busy: boolean;
  readOnly: boolean;
  onSessionChange: (value: string) => void;
  onLoad: (sessionId: string) => void;
  onLoadMore: () => void;
  onModerate?: (sessionId: string, submissionId: string, action: "approve_submission" | "hide_submission", reason?: string) => Promise<unknown>;
  error?: string | null;
}) {
  const selected = sessionId || sessions[0]?.sessionId || "";

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-bold text-foreground">Post-event response review</h3>
        <p className="mt-1 text-sm text-muted-foreground">Anonymous responses remain available to PMCM Admins after event closure while retention allows.</p>
      </CardHeader>
      <CardBody>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="review-game-session">Game session</label>
          <Select value={selected} onValueChange={onSessionChange}>
            <SelectTrigger id="review-game-session" className="min-h-10 w-auto min-w-64 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((session) => <SelectItem key={session.sessionId} value={session.sessionId}>{session.gameTitle} · {session.status}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" disabled={!selected || busy} onClick={() => onLoad(selected)}>Load responses</Button>
        </div>
        <InlineError message={error} />
        <div className="mt-4 space-y-3">
          {responses.map((response) => (
            <ResponseRow key={response.id} response={response} sessionId={selected} busy={busy} readOnly={readOnly} onModerate={onModerate} />
          ))}
          {!responses.length ? <p className="text-sm text-muted-foreground">No responses loaded for this session.</p> : null}
        </div>
        {hasMore ? <Button type="button" className="mt-4" variant="outline" disabled={busy} onClick={onLoadMore}>Load more responses</Button> : null}
      </CardBody>
    </Card>
  );
}

function ResponseRow({
  response,
  sessionId,
  busy,
  readOnly,
  onModerate,
}: {
  response: PrismGameSessionResponse;
  sessionId: string;
  busy: boolean;
  readOnly: boolean;
  onModerate?: ResponseReviewSectionProps["onModerate"];
}) {
  const [reason, setReason] = useState("");
  return (
    <article className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">{response.participantAlias} · Round {response.roundNumber}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{responseText(response.response)}</p>
        </div>
        <StatusBadge status={response.moderationStatus} />
      </div>
      {!readOnly && onModerate ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={busy || response.moderationStatus === "visible"} onClick={() => void onModerate(sessionId, response.id, "approve_submission")}>Approve</Button>
          <label className="sr-only" htmlFor={"hide-reason-" + response.id}>Reason for hiding response</label>
          <Input id={"hide-reason-" + response.id} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Reason to hide" className="h-8 w-auto min-w-48" />
          <Button type="button" size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => void onModerate(sessionId, response.id, "hide_submission", reason.trim())}>Hide</Button>
        </div>
      ) : null}
    </article>
  );
}

type ResponseReviewSectionProps = Parameters<typeof ResponseReviewSection>[0];
