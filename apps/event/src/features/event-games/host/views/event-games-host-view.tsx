"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Gamepad2 } from "lucide-react";
import type {
  PrismAssignEventGameAwardInput,
  PrismEventGameDefinition,
  PrismGameHostCommandInput,
  PrismGameHostState,
  PrismGameLeaderboardEntry,
  PrismGameSessionResponse,
  PrismUserRole,
  PrismUpdateEventGameInput,
} from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { Card, CardBody, CardHeader } from "@/features/event-dashboard/shell/views/sections/shell-ui";
import { EVENT_GAME_OPTIONS, eventGameModeLabel, eventGameOption } from "../model/event-game-catalog";
import { useEventGamesHostViewModel } from "../view-models/use-event-games-host-view-model";
import {
  EventGameAnalyticsCard,
  EventGameCatalogCard,
  EventGameDraftCard,
  EventGamesHeaderCard,
  GuestGameLobbyCard,
} from "./event-games-host-sections";
import { EventGameTemplateConfigurationEditor, hasPublishableTemplateConfiguration } from "./event-game-template-configuration-editor";

type Props = {
  eventId: string | null;
  role: PrismUserRole;
  eventStatus: string;
  archived: boolean;
  actualEndedAt?: string | null;
};

type FamilyFeudAnswerBoard = NonNullable<PrismGameHostState["currentRound"]>["answerBoard"];

function isoDateTime(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function responseText(response: PrismGameSessionResponse["response"]): string {
  return typeof response === "string" ? response : JSON.stringify(response);
}

export function EventGamesHostView({ eventId, role, eventStatus, archived, actualEndedAt }: Props) {
  const vm = useEventGamesHostViewModel({ eventId, role, eventStatus, archived, actualEndedAt });
  const [responseSessionId, setResponseSessionId] = useState("");

  if (!eventId) {
    return (
      <Card>
        <CardBody>
          <EmptyState icon={Gamepad2} title="Select an event" description="Open an event workspace to create and host games." />
        </CardBody>
      </Card>
    );
  }

  if (!vm.canManage && !vm.canReviewResponses) {
    return (
      <Card>
        <CardBody>
          <EmptyState icon={AlertCircle} title="Host access unavailable" description="Game host controls are available to PMCM Admins and event-assigned Coordinators." />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5" aria-label="Event games host workspace">
      <EventGamesHeaderCard loading={vm.loading} busy={Boolean(vm.busy)} error={vm.error} onRefresh={() => void vm.load()} />
      {vm.canManage ? (
        <>
          <EventGameDraftCard busy={Boolean(vm.busy)} onCreate={vm.createDraft} />
          <EventGameCatalogCard
            games={vm.games}
            renderGame={(game) => (
              <GameDefinitionRow
                key={game.id}
                game={game}
                busy={Boolean(vm.busy)}
                onUpdate={vm.updateDraft}
                onArchive={vm.archiveGame}
                onPublish={vm.publishDraft}
                onSchedule={vm.scheduleSession}
                onUploadMedia={vm.uploadGameMedia}
              />
            )}
          />
          <GuestGameLobbyCard
            lobbySlug={vm.lobbySlug}
            branding={vm.lobbyBranding}
            busy={Boolean(vm.busy)}
            onProvision={() => void vm.provisionLobby()}
            onSaveBranding={(settings) => void vm.updateLobbyBranding(settings)}
            onUploadLogo={(file) => vm.uploadLobbyLogo(file)}
          />
          <GameSessionSection vm={vm} />
        </>
      ) : (
        <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This event has ended. Game analytics and retained responses are available as read-only history.
        </p>
      )}
      <EventGameAnalyticsCard
        analytics={vm.analytics}
        onSelectSession={vm.canManage ? (sessionId) => void vm.selectSession(sessionId) : undefined}
      />
      {vm.canReviewResponses ? (
        <ResponseReviewSection
          sessionId={responseSessionId}
          sessions={vm.analytics?.sessions ?? []}
          responses={vm.responses}
          hasMore={vm.responsesHaveMore}
          busy={Boolean(vm.busy)}
          onSessionChange={setResponseSessionId}
          onLoad={(sessionId) => void vm.loadResponses(sessionId)}
          onLoadMore={() => void vm.loadMoreResponses()}
          readOnly={!vm.canManage}
          onModerate={vm.canManage ? vm.moderateSubmission : undefined}
        />
      ) : null}
    </div>
  );
}
function GameDefinitionRow({
  game,
  busy,
  onUpdate,
  onArchive,
  onPublish,
  onSchedule,
  onUploadMedia,
}: {
  game: PrismEventGameDefinition;
  busy: boolean;
  onUpdate: (gameId: string, input: PrismUpdateEventGameInput) => Promise<unknown>;
  onArchive: (gameId: string) => Promise<unknown>;
  onPublish: (gameId: string) => Promise<unknown>;
  onSchedule: (gameId: string, scheduledStartAt?: string) => Promise<unknown>;
  onUploadMedia: (gameId: string, file: File) => Promise<{ objectId: string }>;
}) {
  const [editing, setEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(game.title);
  const [scheduleAt, setScheduleAt] = useState("");

  return (
    <article className="rounded-lg border border-border bg-background p-4">
      <GameDefinitionSummary game={game} />
      <GameDefinitionEditForm
        gameId={game.id}
        editing={editing}
        editedTitle={editedTitle}
        busy={busy}
        setEditedTitle={setEditedTitle}
        onCancel={() => setEditing(false)}
        onSave={async (title) => {
          const result = await onUpdate(game.id, { title });
          if (result) setEditing(false);
        }}
      />
      {(game.status === "draft" || (game.status === "published" && !game.hasStartedSession)) ? (
        <EventGameTemplateConfigurationEditor
          game={game}
          busy={busy}
          onSave={(configuration) => onUpdate(game.id, { configuration })}
          onUploadMedia={(file) => onUploadMedia(game.id, file)}
        />
      ) : null}
      <GameDefinitionActions
        game={game}
        busy={busy}
        scheduleAt={scheduleAt}
        setScheduleAt={setScheduleAt}
        onEdit={() => setEditing(true)}
        onArchive={onArchive}
        onPublish={onPublish}
        onSchedule={onSchedule}
      />
      <GameInstructionsPanel instructions={game.instructions} />
    </article>
  );
}

function GameDefinitionSummary({ game }: { game: PrismEventGameDefinition }) {
  const option = eventGameOption(game.kind);
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h4 className="truncate text-sm font-bold text-foreground">{game.title}</h4>
        <p className="mt-1 text-xs text-muted-foreground">{option?.label ?? game.kind} · {eventGameModeLabel(game.entryMode)} · v{game.version}</p>
        {game.description ? <p className="mt-2 text-sm text-muted-foreground">{game.description}</p> : null}
      </div>
      <StatusBadge status={game.status} />
    </div>
  );
}

function GameDefinitionEditForm({
  gameId,
  editing,
  editedTitle,
  busy,
  setEditedTitle,
  onCancel,
  onSave,
}: {
  gameId: string;
  editing: boolean;
  editedTitle: string;
  busy: boolean;
  setEditedTitle: (value: string) => void;
  onCancel: () => void;
  onSave: (title: string) => Promise<void>;
}) {
  if (!editing) return null;
  return (
    <form className="mt-3 flex flex-wrap gap-2" onSubmit={(event) => {
      event.preventDefault();
      const title = editedTitle.trim();
      if (title) void onSave(title);
    }}>
      <label className="sr-only" htmlFor={"edit-game-" + gameId}>Game title</label>
      <input id={"edit-game-" + gameId} value={editedTitle} maxLength={120} onChange={(event) => setEditedTitle(event.target.value)} className="min-h-9 min-w-48 flex-1 rounded-lg border border-border bg-card px-3 text-sm" />
      <Button type="submit" size="sm" disabled={!editedTitle.trim() || busy}>Save</Button>
      <Button type="button" size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
    </form>
  );
}

function GameDefinitionActions({
  game,
  busy,
  scheduleAt,
  setScheduleAt,
  onEdit,
  onArchive,
  onPublish,
  onSchedule,
}: {
  game: PrismEventGameDefinition;
  busy: boolean;
  scheduleAt: string;
  setScheduleAt: (value: string) => void;
  onEdit: () => void;
  onArchive: (gameId: string) => Promise<unknown>;
  onPublish: (gameId: string) => Promise<unknown>;
  onSchedule: (gameId: string, scheduledStartAt?: string) => Promise<unknown>;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <GameDraftActions game={game} busy={busy} onEdit={onEdit} onPublish={onPublish} />
      <GameArchiveAction game={game} busy={busy} onArchive={onArchive} />
      <GameScheduleAction game={game} busy={busy} scheduleAt={scheduleAt} setScheduleAt={setScheduleAt} onSchedule={onSchedule} />
    </div>
  );
}

function GameDraftActions({
  game, busy, onEdit, onPublish,
}: {
  game: PrismEventGameDefinition; busy: boolean; onEdit: () => void; onPublish: (gameId: string) => Promise<unknown>;
}) {
  const editableBeforeStart = game.status === "draft" || (game.status === "published" && !game.hasStartedSession);
  if (!editableBeforeStart) return null;
  if (hasPublishableTemplateConfiguration(game)) {
    return <>
      <Button type="button" size="sm" variant="outline" onClick={onEdit} disabled={busy}>Edit</Button>
      {game.status === "draft" ? <Button type="button" size="sm" onClick={() => void onPublish(game.id)} disabled={busy}>Publish game</Button> : null}
    </>;
  }
  return <>
    {game.status === "draft" ? <span className="text-xs text-muted-foreground">Save a complete template configuration before publishing.</span> : null}
    <Button type="button" size="sm" variant="outline" onClick={onEdit} disabled={busy}>Edit</Button>
  </>;
}

function GameArchiveAction({
  game, busy, onArchive,
}: {
  game: PrismEventGameDefinition; busy: boolean; onArchive: (gameId: string) => Promise<unknown>;
}) {
  if (game.status === "removed") return null;
  return <Button type="button" size="sm" variant="outline" onClick={() => void onArchive(game.id)} disabled={busy}>Archive</Button>;
}

function GameScheduleAction({
  game, busy, scheduleAt, setScheduleAt, onSchedule,
}: {
  game: PrismEventGameDefinition; busy: boolean; scheduleAt: string; setScheduleAt: (value: string) => void;
  onSchedule: (gameId: string, scheduledStartAt?: string) => Promise<unknown>;
}) {
  if (game.entryMode !== "active" || game.status !== "published") return null;
  return <>
    <label className="sr-only" htmlFor={"session-start-" + game.id}>Scheduled session start</label>
    <input id={"session-start-" + game.id} type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} className="min-h-9 rounded-lg border border-border bg-card px-2 text-xs" />
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void onSchedule(game.id, isoDateTime(scheduleAt))}>
      {scheduleAt ? "Schedule session" : "Create host session"}
    </Button>
  </>;
}

function GameInstructionsPanel({ instructions }: { instructions?: string }) {
  if (!instructions) return null;
  return <details className="mt-3 text-xs text-muted-foreground"><summary className="cursor-pointer font-semibold">Game instructions</summary><p className="mt-2 whitespace-pre-wrap">{instructions}</p></details>;
}

function awardRecipientValue(recipient: PrismGameLeaderboardEntry["awardRecipient"]): string {
  if (!recipient) return "";
  return recipient.type === "participant"
    ? "participant:" + recipient.participationGrantId
    : "team:" + recipient.teamId;
}

function GameSessionSection({
  vm,
}: {
  vm: ReturnType<typeof useEventGamesHostViewModel>;
}) {
  const hostState = vm.hostState;
  if (!hostState) return null;
  const activeSession = !["completed", "cancelled"].includes(hostState.status);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground">{hostState.game.title} host dashboard</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {hostState.participantCount} participants
              {hostState.currentRound ? " · Round " + hostState.currentRound.number + " of " + hostState.currentRound.total : ""}
            </p>
          </div>
          <StatusBadge status={hostState.status} />
        </div>
      </CardHeader>
      <CardBody>
        <CurrentRoundSection hostState={hostState} />
        {hostState.sessionResult?.kind === "spin-wheel" ? (
          <section className="mb-4 rounded-md border border-border bg-background p-4" aria-label="Wheel result">
            <p className="text-sm font-semibold">Wheel result</p>
            <p role="status" className="mt-1">{hostState.sessionResult.label} · {hostState.sessionResult.points} points</p>
          </section>
        ) : null}
        {hostState.game.kind === "split-the-room" && hostState.currentRound?.pendingSubmissions ? (
          <SplitResponseModerationQueue
            sessionId={hostState.sessionId}
            submissions={hostState.currentRound.pendingSubmissions}
            busy={Boolean(vm.busy)}
            onModerate={vm.moderateSubmission}
          />
        ) : null}
        {hostState.game.kind === "family-feud" && hostState.currentRound?.pendingAnswers ? (
          <FamilyFeudAdjudicationQueue
            sessionId={hostState.sessionId}
            answerBoard={hostState.currentRound.answerBoard}
            answers={hostState.currentRound.pendingAnswers}
            busy={Boolean(vm.busy)}
            onResolve={vm.resolveFamilyFeudAnswer}
          />
        ) : null}
        <GameHostCommandButtons
          hostState={hostState}
          activeSession={activeSession}
          busy={Boolean(vm.busy)}
          pinDismissed={vm.pinDismissed}
          onCommand={vm.runHostCommand}
        />
        <SessionPinDisclosure pin={vm.revealedPin} dismissed={vm.pinDismissed} onDismiss={vm.dismissPin} />
        {supportsCompetitiveLeaderboard(hostState.game.kind) ? (
          <>
            <LiveLeaderboard entries={hostState.leaderboard} />
            <AwardAssignmentSection
              hostState={hostState}
              busy={Boolean(vm.busy)}
              onAssign={vm.assignAward}
            />
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}

function CurrentRoundSection({ hostState }: { hostState: PrismGameHostState }) {
  const round = hostState.currentRound;
  if (!round) return null;
  const label = hostState.game.kind === "bingo"
    ? "Current number call"
    : `Round ${round.number} of ${round.total}`;
  return <section className="mb-4 rounded-md border border-border bg-background p-4" aria-label="Current game round">
    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
    <p className="mt-1 font-semibold">{round.prompt}</p>
    <GameRoundDetails hostState={hostState} />
    {hostState.aggregateResults?.length ? <AggregateVoteResults results={hostState.aggregateResults} /> : null}
  </section>;
}

function GameRoundDetails({ hostState }: { hostState: PrismGameHostState }) {
  const round = hostState.currentRound;
  if (!round) return null;
  if (hostState.game.kind === "live-trivia") {
    return round.revealedAnswer
      ? <p className="mt-2 text-sm">Correct answer: <strong>{round.revealedAnswer}</strong></p>
      : <p className="mt-2 text-xs text-muted-foreground">Pause the round to reveal its answer to the host.</p>;
  }
  if (hostState.game.kind === "bingo") {
    return <p className="mt-2 text-xs text-muted-foreground">Number calls follow the configured server schedule. Pause or resume the call sequence below.</p>;
  }
  if (hostState.game.kind === "family-feud") {
    return <FamilyFeudAnswerBoard answerBoard={round.answerBoard} />;
  }
  return null;
}

function FamilyFeudAnswerBoard({ answerBoard }: {
  answerBoard: NonNullable<NonNullable<PrismGameHostState["currentRound"]>["answerBoard"]> | undefined;
}) {
  if (!answerBoard) return <p className="mt-2 text-xs text-muted-foreground">The configured answer board is unavailable.</p>;
  return <ul className="mt-3 grid gap-2" aria-label="Host answer board">
    {answerBoard.map((item) => <li key={item.answer} className="rounded-md border border-border px-3 py-2 text-sm">
      <strong>{item.answer}</strong> · {item.points} points
      {item.alternatives.length ? <p className="mt-1 text-xs text-muted-foreground">Accepted alternatives: {item.alternatives.join(", ")}</p> : null}
    </li>)}
  </ul>;
}

function FamilyFeudAdjudicationQueue({
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

function AggregateVoteResults({ results }: {
  results: NonNullable<PrismGameHostState["aggregateResults"]>;
}) {
  return <ul className="mt-3 grid gap-2" aria-label="Aggregate vote results">
    {results.map((item) => <li key={item.label} className="flex justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm">
      <span>{item.label}</span><strong>{item.count}</strong>
    </li>)}
  </ul>;
}

function SplitResponseModerationQueue({
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
      <input id={`split-hide-reason-${submission.id}`} value={reason} onChange={(event) => setReason(event.target.value)}
        maxLength={500} placeholder="Reason to hide" className="min-h-9 min-w-48 rounded-lg border border-border bg-card px-3 text-sm" />
      <Button type="button" size="sm" variant="outline" disabled={busy || !reason.trim()}
        onClick={() => void onModerate(sessionId, submission.id, "hide_submission", reason.trim())}>
        Hide
      </Button>
    </div>
  </li>;
}

function GameHostCommandButtons({
  hostState,
  activeSession,
  busy,
  pinDismissed,
  onCommand,
}: {
  hostState: PrismGameHostState;
  activeSession: boolean;
  busy: boolean;
  pinDismissed: boolean;
  onCommand: (sessionId: string, command: PrismGameHostCommandInput["command"], roundKey?: string) => Promise<unknown>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <GameLifecycleButtons hostState={hostState} activeSession={activeSession} busy={busy} onCommand={onCommand} />
      <SpinWheelButton hostState={hostState} busy={busy} onCommand={onCommand} />
      <AdvanceRoundButton hostState={hostState} busy={busy} onCommand={onCommand} />
      <SessionPinButton hostState={hostState} activeSession={activeSession} busy={busy} pinDismissed={pinDismissed} onCommand={onCommand} />
    </div>
  );
}

function SpinWheelButton({ hostState, busy, onCommand }: {
  hostState: PrismGameHostState;
  busy: boolean;
  onCommand: (sessionId: string, command: PrismGameHostCommandInput["command"], roundKey?: string) => Promise<unknown>;
}) {
  if (hostState.game.kind !== "spin-wheel" || hostState.status !== "live" || hostState.sessionResult?.kind === "spin-wheel") {
    return null;
  }
  return <Button type="button" onClick={() => void onCommand(hostState.sessionId, "spin-wheel")} disabled={busy}>
    Spin wheel
  </Button>;
}

function GameLifecycleButtons({ hostState, activeSession, busy, onCommand }: {
  hostState: PrismGameHostState;
  activeSession: boolean;
  busy: boolean;
  onCommand: (sessionId: string, command: PrismGameHostCommandInput["command"], roundKey?: string) => Promise<unknown>;
}) {
  const canStart = hostState.status === "scheduled" || hostState.status === "lobby";
  return <>
    {canStart ? <Button type="button" onClick={() => void onCommand(hostState.sessionId, "start")} disabled={busy}>{hostStartLabel(hostState.game.kind)}</Button> : null}
    {hostState.status === "live" ? <Button type="button" variant="outline" onClick={() => void onCommand(hostState.sessionId, "pause")} disabled={busy}>{hostPauseLabel(hostState.game.kind)}</Button> : null}
    {hostState.status === "paused" ? <Button type="button" onClick={() => void onCommand(hostState.sessionId, "resume")} disabled={busy}>{hostResumeLabel(hostState.game.kind)}</Button> : null}
    {activeSession ? <Button type="button" variant="outline" onClick={() => void onCommand(hostState.sessionId, "end")} disabled={busy}>End game</Button> : null}
  </>;
}

function AdvanceRoundButton({ hostState, busy, onCommand }: {
  hostState: PrismGameHostState;
  busy: boolean;
  onCommand: (sessionId: string, command: PrismGameHostCommandInput["command"], roundKey?: string) => Promise<unknown>;
}) {
  const round = hostState.currentRound;
  if (!round || round.number >= round.total || !["live", "paused"].includes(hostState.status)) return null;
  return <Button type="button" variant="outline" onClick={() => void onCommand(hostState.sessionId, "advance-round", round.key)} disabled={busy}>Next round</Button>;
}

function SessionPinButton({ hostState, activeSession, busy, pinDismissed, onCommand }: {
  hostState: PrismGameHostState;
  activeSession: boolean;
  busy: boolean;
  pinDismissed: boolean;
  onCommand: (sessionId: string, command: PrismGameHostCommandInput["command"], roundKey?: string) => Promise<unknown>;
}) {
  if (!activeSession) return null;
  return <Button type="button" variant="outline" onClick={() => void onCommand(hostState.sessionId, "enable-joins")} disabled={busy}>
    {pinDismissed ? "Rotate PIN" : "Issue or rotate PIN"}
  </Button>;
}

function hostStartLabel(kind: PrismGameHostState["game"]["kind"]): string {
  return kind === "bingo" ? "Start number calls" : "Start";
}

function hostPauseLabel(kind: PrismGameHostState["game"]["kind"]): string {
  if (kind === "live-trivia") return "Reveal answer and pause";
  if (kind === "family-feud") return "Pause and reveal board";
  if (kind === "this-or-that") return "Pause voting";
  if (kind === "split-the-room") return "Reveal totals and pause";
  return kind === "bingo" ? "Pause number calls" : "Pause";
}

function hostResumeLabel(kind: PrismGameHostState["game"]["kind"]): string {
  if (kind === "live-trivia") return "Resume timed questions";
  if (kind === "family-feud") return "Resume questions";
  if (kind === "this-or-that") return "Resume voting";
  if (kind === "split-the-room") return "Resume timed prompts";
  return kind === "bingo" ? "Resume number calls" : "Resume";
}

function SessionPinDisclosure({ pin, dismissed, onDismiss }: { pin: string | null; dismissed: boolean; onDismiss: () => void }) {
  if (pin) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary-soft p-3">
        <p className="text-sm font-semibold text-foreground">Share this PIN with attendees:</p>
        <code className="rounded bg-background px-3 py-1 text-lg font-bold tracking-[0.25em]">{pin}</code>
        <Button type="button" size="sm" variant="outline" onClick={onDismiss}>Hide PIN</Button>
      </div>
    );
  }
  if (!dismissed) return null;
  return <p className="mt-3 text-sm text-muted-foreground">The previous PIN is hidden. Rotate the PIN to reveal a new one.</p>;
}

function LiveLeaderboard({ entries }: { entries: PrismGameHostState["leaderboard"] }) {
  if (entries.length === 0) return <p className="mt-4 text-sm text-muted-foreground">The leaderboard will appear after participants join and submit responses.</p>;
  return (
    <section className="mt-5" aria-label="Live leaderboard">
      <h4 className="mb-2 text-sm font-bold text-foreground">Live leaderboard</h4>
      <ol className="space-y-2">
        {entries.map((entry) => <li key={entry.rank + "-" + entry.label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
          <span>{entry.rank}. {entry.label}{entry.teamLabel && entry.teamLabel !== entry.label ? " · " + entry.teamLabel : ""}</span>
          <span className="font-bold">{entry.score} points</span>
        </li>)}
      </ol>
    </section>
  );
}

function supportsCompetitiveLeaderboard(kind: PrismGameHostState["game"]["kind"]): boolean {
  return ["live-trivia", "bingo", "guess-picture", "spin-wheel", "family-feud"].includes(kind);
}

type HostAwardInput = Omit<PrismAssignEventGameAwardInput, "idempotencyKey">;

function buildHostAwardInput(
  kind: "points" | "badge" | "prize",
  recipient: PrismGameLeaderboardEntry["awardRecipient"],
  label: string,
  points: string,
  prizeReference: string,
): HostAwardInput | null {
  if (!recipient || !label.trim()) return null;
  const normalizedLabel = label.trim();
  if (kind === "points") {
    const parsedPoints = points === "" ? Number.NaN : Number(points);
    if (!Number.isInteger(parsedPoints) || parsedPoints < 0 || parsedPoints > 100_000) return null;
    return { recipient, awardKind: kind, label: normalizedLabel, points: parsedPoints };
  }
  if (kind === "prize") {
    const normalizedReference = prizeReference.trim();
    if (!normalizedReference) return null;
    return { recipient, awardKind: kind, label: normalizedLabel, prizeReference: normalizedReference };
  }
  return { recipient, awardKind: kind, label: normalizedLabel };
}

function AwardAssignmentSection({
  hostState,
  busy,
  onAssign,
}: {
  hostState: PrismGameHostState;
  busy: boolean;
  onAssign: (sessionId: string, input: HostAwardInput) => Promise<unknown>;
}) {
  const [recipientKey, setRecipientKey] = useState("");
  const [kind, setKind] = useState<"points" | "badge" | "prize">("points");
  const [label, setLabel] = useState("");
  const [points, setPoints] = useState("");
  const [prizeReference, setPrizeReference] = useState("");
  useEffect(() => {
    setRecipientKey("");
    setLabel("");
    setPoints("");
    setPrizeReference("");
  }, [hostState.sessionId]);
  const recipients = hostState.leaderboard.filter((entry) => entry.awardRecipient);
  const selected = recipients.find((entry) => awardRecipientValue(entry.awardRecipient) === recipientKey) ?? recipients[0];
  const input = buildHostAwardInput(kind, selected?.awardRecipient, label, points, prizeReference);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input) return;
    void onAssign(hostState.sessionId, input).then((result) => {
      if (!result) return;
      setLabel("");
      setPoints("");
      setPrizeReference("");
    });
  }

  return (
    <section className="mt-5 border-t border-border pt-4" aria-label="Assign an award">
      <h4 className="text-sm font-bold text-foreground">Assign an award</h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Prize assignments are event records; organizers handle fulfillment.
      </p>
      {recipients.length ? (
        <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
          <label className="grid gap-1 text-sm font-semibold text-foreground">
            Award recipient
            <select
              aria-label="Award recipient"
              value={awardRecipientValue(selected?.awardRecipient)}
              onChange={(event) => setRecipientKey(event.target.value)}
              className="min-h-10 rounded-lg border border-border bg-background px-3"
            >
              {recipients.map((entry) => (
                <option key={awardRecipientValue(entry.awardRecipient)} value={awardRecipientValue(entry.awardRecipient)}>
                  {entry.label}{entry.teamLabel && entry.teamLabel !== entry.label ? " · " + entry.teamLabel : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-foreground">
            Award type
            <select
              aria-label="Award type"
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
              className="min-h-10 rounded-lg border border-border bg-background px-3"
            >
              <option value="points">Points</option>
              <option value="badge">Badge</option>
              <option value="prize">Prize</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-foreground sm:col-span-2">
            Award label
            <input aria-label="Award label" value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3" />
          </label>
          {kind === "points" ? (
            <label className="grid gap-1 text-sm font-semibold text-foreground">
              Points
              <input aria-label="Points" type="number" min={0} max={100_000} step={1} value={points} onChange={(event) => setPoints(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3" />
            </label>
          ) : null}
          {kind === "prize" ? (
            <label className="grid gap-1 text-sm font-semibold text-foreground">
              Prize reference
              <input aria-label="Prize reference" value={prizeReference} maxLength={200} onChange={(event) => setPrizeReference(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3" />
            </label>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={!input || busy}>Assign award</Button>
          </div>
        </form>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">An award can be assigned after a participant or team appears on the leaderboard.</p>
      )}
    </section>
  );
}

function ResponseReviewSection({
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
          <select id="review-game-session" value={selected} onChange={(event) => onSessionChange(event.target.value)} className="min-h-10 rounded-lg border border-border bg-background px-3">
            {sessions.map((session) => <option key={session.sessionId} value={session.sessionId}>{session.gameTitle} · {session.status}</option>)}
          </select>
          <Button type="button" variant="outline" disabled={!selected || busy} onClick={() => onLoad(selected)}>Load responses</Button>
        </div>
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
          <input id={"hide-reason-" + response.id} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Reason to hide" className="min-h-9 min-w-48 rounded-lg border border-border bg-card px-3 text-sm" />
          <Button type="button" size="sm" variant="outline" disabled={busy || !reason.trim()} onClick={() => void onModerate(sessionId, response.id, "hide_submission", reason.trim())}>Hide</Button>
        </div>
      ) : null}
    </article>
  );
}

type ResponseReviewSectionProps = Parameters<typeof ResponseReviewSection>[0];
