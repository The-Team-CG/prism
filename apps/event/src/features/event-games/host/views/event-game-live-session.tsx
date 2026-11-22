"use client";

import type { PrismGameHostCommandInput, PrismGameHostState } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { Card, CardBody, CardHeader } from "@/features/event-dashboard/shell/views/sections/shell-ui";
import type { useEventGamesHostViewModel } from "../view-models/use-event-games-host-view-model";
import { AwardAssignmentSection } from "./event-game-awards";
import { FamilyFeudAdjudicationQueue, SplitResponseModerationQueue } from "./event-game-live-moderation";
import { InlineError } from "./event-games-host-sections";

type HostViewModel = ReturnType<typeof useEventGamesHostViewModel>;

/** Run live: pick a session, then run its lifecycle, PIN, presenter view, moderation, leaderboard and awards. */
export function RunLivePanel({ vm }: { vm: HostViewModel }) {
  const sessions = vm.analytics?.sessions ?? [];
  const liveError = vm.errorTarget === "live" ? vm.error : null;
  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          {sessions.length ? (
            <label className="grid max-w-md gap-1.5 text-sm font-semibold text-foreground">
              Session to run
              <Select value={vm.selectedSessionId ?? ""} onValueChange={(sessionId) => void vm.selectSession(sessionId)}>
                <SelectTrigger aria-label="Session to run" className="min-h-10 w-full min-w-0 bg-background">
                  <SelectValue placeholder="Choose a session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.sessionId} value={session.sessionId}>{session.gameTitle} · {session.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : (
            <p className="text-sm text-muted-foreground">No sessions yet. Publish an Active (Multiplayer) game in Set up, then create a host session for it.</p>
          )}
          <InlineError message={liveError} />
        </CardBody>
      </Card>
      {vm.hostState ? <GameSessionSection vm={vm} /> : sessions.length ? (
        <p className="text-sm text-muted-foreground">Choose a session to see its controls.</p>
      ) : null}
    </div>
  );
}

export function GameSessionSection({
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
        {["split-the-room", "word-cloud", "open-qa", "presenter-deck"].includes(hostState.game.kind) && hostState.currentRound?.pendingSubmissions ? (
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


function AggregateVoteResults({ results }: {
  results: NonNullable<PrismGameHostState["aggregateResults"]>;
}) {
  return <ul className="mt-3 grid gap-2" aria-label="Aggregate vote results">
    {results.map((item) => <li key={item.label} className="flex justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm">
      <span>{item.label}</span><strong>{item.count}</strong>
    </li>)}
  </ul>;
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
      <PresenterViewButton hostState={hostState} />
    </div>
  );
}

/** Opens the large-screen presenter view for this session in a new tab. */
function PresenterViewButton({ hostState }: { hostState: PrismGameHostState }) {
  const href = `/dashboard/events/${encodeURIComponent(hostState.eventId)}/presenter/${encodeURIComponent(hostState.sessionId)}`;
  return <Button type="button" variant="outline" onClick={() => window.open(href, "_blank", "noopener")}>
    Open presenter view
  </Button>;
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
  // The API only advances timed rounds (it needs a deadline); untimed rounds such as Bingo number calls advance on their own.
  if (!round || !round.deadlineAt || round.number >= round.total || !["live", "paused"].includes(hostState.status)) return null;
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
  if (kind === "split-the-room" || kind === "live-poll") return "Reveal totals and pause";
  if (kind === "word-cloud" || kind === "open-qa") return "Show approved answers and pause";
  if (kind === "presenter-deck") return "Reveal results and pause";
  return kind === "bingo" ? "Pause number calls" : "Pause";
}

function hostResumeLabel(kind: PrismGameHostState["game"]["kind"]): string {
  if (kind === "live-trivia") return "Resume timed questions";
  if (kind === "family-feud") return "Resume questions";
  if (kind === "this-or-that") return "Resume voting";
  if (["split-the-room", "live-poll", "word-cloud", "open-qa", "presenter-deck"].includes(kind)) return "Resume timed prompts";
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
