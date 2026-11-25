import type { ReactNode } from "react";
import type { PrismGameHostState, PrismGameLeaderboardEntry, PrismGameSessionResult } from "@prism/types";
import { GameStandings, gameChoiceTone } from "@prism/ui/event-games";

/**
 * Room-safe building blocks shared by presenter renderers. None of them accept moderation
 * queues, so a renderer composed from these cannot leak pending text to the big screen.
 */

type VoteTotals = NonNullable<PrismGameHostState["aggregateResults"]>;
type AnswerBoard = NonNullable<NonNullable<PrismGameHostState["currentRound"]>["answerBoard"]>;

export function PresenterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-5">
      <h2 className="text-2xl font-semibold text-white/60 md:text-3xl">{title}</h2>
      {children}
    </section>
  );
}

/** The round's question, as large as the screen allows, with how many people are playing along. */
export function PresenterPrompt({ prompt, participantCount, action, compact = false }: {
  prompt: string;
  participantCount?: number;
  /** A short instruction under the count, such as "Answer on your phone". */
  action?: string | null;
  /** Smaller, once the answers or results need the room. */
  compact?: boolean;
}) {
  return (
    <section aria-label="Current question" className={`flex flex-col items-center text-center ${compact ? "gap-4 py-2" : "gap-8 py-8"}`}>
      <p className={`max-w-6xl font-bold leading-tight ${compact ? "text-4xl md:text-6xl" : "text-5xl md:text-7xl"}`}>{prompt}</p>
      {participantCount !== undefined ? (
        <p className="text-3xl text-white/75 md:text-4xl">
          <span className="font-bold tabular-nums text-[#f2b134]">{participantCount}</span>{" "}
          {participantCount === 1 ? "person" : "people"} {action ? "playing" : "answering on their phones"}
        </p>
      ) : null}
      {action ? <p className="text-3xl font-semibold md:text-4xl">{action}</p> : null}
    </section>
  );
}

/** `lettered` matches each bar to the A/B/C tile guests tapped; rating scales already label themselves. */
export function PresenterVoteBars({ results, title = "Results", lettered = true }: { results: VoteTotals; title?: string; lettered?: boolean }) {
  const total = results.reduce((sum, { count }) => sum + count, 0);
  const max = Math.max(1, ...results.map(({ count }) => count));
  return (
    <PresenterSection title={title}>
      <ul className="space-y-5">
        {results.map(({ label, count }, index) => {
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          const tone = gameChoiceTone(index);
          return (
            <li key={label} className="space-y-2">
              <div className="flex items-baseline justify-between gap-6 text-2xl md:text-4xl">
                <span className="flex items-center gap-4 font-semibold">
                  {lettered ? <span className={`grid size-10 place-items-center rounded-lg text-xl font-bold md:size-12 md:text-2xl ${tone.fill}`} aria-hidden="true">{tone.letter}</span> : null}
                  {label}
                </span>
                <span className="tabular-nums text-white/80">{count} · {share}%</span>
              </div>
              <div className="h-6 overflow-hidden rounded-full bg-white/10 md:h-8">
                <div className={`h-full rounded-full transition-[width] duration-1000 ease-out ${tone.fill}`} style={{ width: `${(count / max) * 100}%` }} aria-hidden="true" />
              </div>
            </li>
          );
        })}
      </ul>
    </PresenterSection>
  );
}

export function PresenterNumberedResponses({ responses, title = "Answers" }: { responses: readonly string[]; title?: string }) {
  return (
    <PresenterSection title={title}>
      <ol className="grid gap-4 text-2xl md:grid-cols-2 md:text-3xl">
        {responses.map((response, index) => (
          <li key={`${index}-${response}`} className="flex gap-4 rounded-3xl bg-white/10 px-6 py-5">
            <span className={`grid size-10 shrink-0 place-items-center rounded-full text-xl font-bold tabular-nums ${gameChoiceTone(index).fill}`}>{index + 1}</span>
            <span className="break-words">{response}</span>
          </li>
        ))}
      </ol>
    </PresenterSection>
  );
}

export function PresenterRevealedAnswer({ answer }: { answer: string }) {
  return (
    <PresenterSection title="Answer">
      <p className="rounded-3xl bg-[var(--prism-success)] px-8 py-6 text-center text-4xl font-bold text-white shadow-2xl md:text-6xl">{answer}</p>
    </PresenterSection>
  );
}

/**
 * The survey board. While the round is open the room sees numbered, face-down tiles; once the host pauses,
 * they flip one after another, top answer first.
 */
export function PresenterAnswerBoard({ board, revealed }: { board: AnswerBoard; revealed: boolean }) {
  return (
    <PresenterSection title="Survey says">
      <ol className="grid gap-4 md:grid-cols-2">
        {board.map(({ answer, points }, index) => (
          <li key={`${index}-${answer}`} className="[perspective:1200px]">
            <div
              className="relative h-24 transition-transform duration-700 [transform-style:preserve-3d] md:h-28"
              style={{ transform: revealed ? "rotateX(180deg)" : "none", transitionDelay: revealed ? `${index * 450}ms` : "0ms" }}
            >
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-[var(--prism-info)] text-5xl font-black shadow-lg [backface-visibility:hidden]" aria-hidden={revealed}>
                {index + 1}
              </div>
              <div className="absolute inset-0 flex items-center justify-between gap-4 rounded-2xl bg-white px-6 text-[var(--prism-ink)] shadow-lg [backface-visibility:hidden] [transform:rotateX(180deg)]" aria-hidden={!revealed}>
                <span className="truncate text-3xl font-bold md:text-4xl">{revealed ? answer : ""}</span>
                <span className="rounded-xl bg-[var(--prism-ink)] px-4 py-2 text-3xl font-black tabular-nums text-white">{revealed ? points : ""}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </PresenterSection>
  );
}

export function PresenterSessionResult({ result }: { result: PrismGameSessionResult }) {
  return (
    <section aria-label="Result" role="status" className="rounded-3xl bg-white px-8 py-6 text-center text-[var(--prism-ink)] shadow-2xl">
      <p className="text-2xl font-semibold opacity-70">The wheel landed on</p>
      <p className="text-5xl font-black md:text-7xl">{result.label}</p>
      {result.points > 0 ? <p className="mt-1 text-3xl font-bold tabular-nums text-[var(--prism-orange-deep)]">{result.points} points</p> : null}
    </section>
  );
}

export function PresenterLeaderboard({ entries, title = "Leaderboard" }: { entries: readonly PrismGameLeaderboardEntry[]; title?: string }) {
  // Award references stay with the host console; the room sees ranks, names and scores only.
  const standings = entries.map(({ rank, label, score, teamLabel }) => ({ rank, label, score, ...(teamLabel ? { teamLabel } : {}) }));
  return (
    <PresenterSection title={title}>
      <GameStandings entries={standings} size="stage" limit={8} />
    </PresenterSection>
  );
}

/** Groups approved words case-insensitively, keeping the first spelling seen. */
export function wordCloudTerms(responses: readonly string[]): Array<{ text: string; count: number }> {
  const terms = new Map<string, { text: string; count: number }>();
  for (const response of responses) {
    const text = response.trim();
    if (!text) continue;
    const key = text.toLocaleLowerCase();
    const existing = terms.get(key);
    if (existing) existing.count += 1;
    else terms.set(key, { text, count: 1 });
  }
  return [...terms.values()].sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
}

const CLOUD_COLOURS = ["#ffffff", "#f2b134", "#7fc8e8", "#ff8fb8", "#8fe0c8"];

/** Biggest words in the middle, smaller ones fanning out to both sides. */
function centreOut<T>(items: readonly T[]): T[] {
  const ordered: T[] = [];
  items.forEach((item, index) => { if (index % 2 === 0) ordered.push(item); else ordered.unshift(item); });
  return ordered;
}

export function PresenterWordCloud({ responses, title = "Word cloud" }: { responses: readonly string[]; title?: string }) {
  const terms = wordCloudTerms(responses);
  const max = Math.max(1, ...terms.map(({ count }) => count));
  return (
    <PresenterSection title={title}>
      <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 py-6">
        {centreOut(terms.map((term, index) => ({ ...term, colour: CLOUD_COLOURS[index % CLOUD_COLOURS.length] }))).map(({ text, count, colour }) => (
          <li
            key={text}
            className="font-bold leading-none"
            style={{ fontSize: `${1.75 + (count / max) * 4.5}rem`, opacity: 0.6 + (count / max) * 0.4, color: colour }}
            title={`${count} ${count === 1 ? "response" : "responses"}`}
          >
            {text}
          </li>
        ))}
      </ul>
    </PresenterSection>
  );
}
