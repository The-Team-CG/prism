import type { ReactNode } from "react";
import type { PrismGameHostState, PrismGameLeaderboardEntry, PrismGameSessionResult } from "@prism/types";

/**
 * Room-safe building blocks shared by presenter renderers. None of them accept moderation
 * queues, so a renderer composed from these cannot leak pending text to the big screen.
 */

type VoteTotals = NonNullable<PrismGameHostState["aggregateResults"]>;
type AnswerBoard = NonNullable<NonNullable<PrismGameHostState["currentRound"]>["answerBoard"]>;

export function PresenterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-4">
      <h2 className="text-2xl font-semibold text-white/70 md:text-3xl">{title}</h2>
      {children}
    </section>
  );
}

export function PresenterVoteBars({ results, title = "Results" }: { results: VoteTotals; title?: string }) {
  const total = results.reduce((sum, { count }) => sum + count, 0);
  const max = Math.max(1, ...results.map(({ count }) => count));
  return (
    <PresenterSection title={title}>
      <ul className="space-y-4">
        {results.map(({ label, count }) => {
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={label} className="space-y-2">
              <div className="flex items-baseline justify-between gap-6 text-2xl md:text-4xl">
                <span className="font-semibold">{label}</span>
                <span className="tabular-nums text-white/80">{count} · {share}%</span>
              </div>
              <div className="h-6 overflow-hidden rounded-full bg-white/10 md:h-8">
                <div
                  className="h-full rounded-full bg-amber-300"
                  style={{ width: `${(count / max) * 100}%` }}
                  aria-hidden="true"
                />
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
      <ol className="grid gap-3 text-2xl md:grid-cols-2 md:text-3xl">
        {responses.map((response, index) => (
          <li key={`${index}-${response}`} className="flex gap-4 rounded-2xl bg-white/10 px-5 py-4">
            <span className="tabular-nums text-amber-300">{index + 1}.</span>
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
      <p className="rounded-3xl bg-emerald-400 px-8 py-6 text-4xl font-bold text-slate-950 md:text-6xl">{answer}</p>
    </PresenterSection>
  );
}

export function PresenterAnswerBoard({ board }: { board: AnswerBoard }) {
  return (
    <PresenterSection title="Answer board">
      <table className="w-full text-left text-2xl md:text-3xl">
        <thead className="text-white/60">
          <tr>
            <th scope="col" className="py-2 pr-4 font-medium">#</th>
            <th scope="col" className="py-2 pr-4 font-medium">Answer</th>
            <th scope="col" className="py-2 text-right font-medium">Points</th>
          </tr>
        </thead>
        <tbody>
          {board.map(({ answer, points }, index) => (
            <tr key={`${index}-${answer}`} className="border-t border-white/15">
              <td className="py-3 pr-4 tabular-nums text-amber-300">{index + 1}</td>
              <td className="py-3 pr-4 font-semibold">{answer}</td>
              <td className="py-3 text-right tabular-nums">{points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PresenterSection>
  );
}

export function PresenterSessionResult({ result }: { result: PrismGameSessionResult }) {
  return (
    <PresenterSection title="Result">
      <div className="flex flex-wrap items-baseline gap-6 rounded-3xl bg-white/10 px-8 py-6">
        <p className="text-5xl font-bold md:text-7xl">{result.label}</p>
        <p className="text-3xl tabular-nums text-amber-300 md:text-4xl">{result.points} points</p>
      </div>
    </PresenterSection>
  );
}

export function PresenterLeaderboard({ entries }: { entries: readonly PrismGameLeaderboardEntry[] }) {
  return (
    <PresenterSection title="Leaderboard">
      <ol className="space-y-2 text-2xl md:text-3xl">
        {entries.map((entry) => (
          <li key={`${entry.rank}-${entry.label}`} className="flex items-baseline gap-5 rounded-2xl bg-white/10 px-5 py-3">
            <span className="w-12 tabular-nums text-amber-300">{entry.rank}</span>
            <span className="flex-1 font-semibold">
              {entry.label}
              {entry.teamLabel ? <span className="ml-3 text-white/60">{entry.teamLabel}</span> : null}
            </span>
            <span className="tabular-nums">{entry.score}</span>
          </li>
        ))}
      </ol>
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

export function PresenterWordCloud({ responses, title = "Word cloud" }: { responses: readonly string[]; title?: string }) {
  const terms = wordCloudTerms(responses);
  const max = Math.max(1, ...terms.map(({ count }) => count));
  return (
    <PresenterSection title={title}>
      <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 py-4">
        {terms.map(({ text, count }) => (
          <li
            key={text}
            className="font-bold leading-none"
            style={{ fontSize: `${1.5 + (count / max) * 4}rem`, opacity: 0.55 + (count / max) * 0.45 }}
            title={`${count} ${count === 1 ? "response" : "responses"}`}
          >
            {text}
          </li>
        ))}
      </ul>
    </PresenterSection>
  );
}
