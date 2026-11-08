"use client";

import type { PrismEventGameDefinition, PrismEventGameTemplateConfiguration } from "@prism/types";
import { Button } from "@/app/components/ui/button";

/** FR-40: editor drafts for Live Poll, Word Cloud and Open Q and A. Fields stay strings until the shared schema parses them. */
export type AudienceKind = "live-poll" | "word-cloud" | "open-qa";
type AudienceRoundDraft = { key: string; prompt: string; options: string; maxResponseLength: string; durationSeconds: string };
export type AudienceDraft = { kind: AudienceKind; rounds: AudienceRoundDraft[] };

export const AUDIENCE_KINDS: readonly AudienceKind[] = ["live-poll", "word-cloud", "open-qa"];

const HELP: Record<AudienceKind, string> = {
  "live-poll": "Guests vote on two to six options. Pause the round to show the totals.",
  "word-cloud": "Guests send a short word or phrase. Approve answers in moderation; paused rounds show the approved cloud.",
  "open-qa": "Guests send questions. Only questions you approve are shown to the room when you pause.",
};

const DEFAULT_SECONDS: Record<AudienceKind, string> = { "live-poll": "30", "word-cloud": "60", "open-qa": "600" };

export function isAudienceKind(kind: string): kind is AudienceKind {
  return (AUDIENCE_KINDS as readonly string[]).includes(kind);
}

export function isAudienceDraft(draft: { kind: string }): draft is AudienceDraft {
  return isAudienceKind(draft.kind);
}

function emptyRound(kind: AudienceKind, index: number): AudienceRoundDraft {
  return { key: `round-${index}`, prompt: "", options: "", maxResponseLength: "30", durationSeconds: DEFAULT_SECONDS[kind] };
}

export function emptyAudienceDraft(kind: PrismEventGameDefinition["kind"]): AudienceDraft | null {
  return isAudienceKind(kind) ? { kind, rounds: [emptyRound(kind, 1)] } : null;
}

export function audienceDraftFrom(config: PrismEventGameTemplateConfiguration): AudienceDraft | null {
  if (config.kind === "live-poll") return { kind: config.kind, rounds: config.rounds.map((round) => ({ key: round.key, prompt: round.prompt, options: round.options.join("\n"), maxResponseLength: "30", durationSeconds: String(round.durationSeconds) })) };
  if (config.kind === "word-cloud") return { kind: config.kind, rounds: config.rounds.map((round) => ({ key: round.key, prompt: round.prompt, options: "", maxResponseLength: String(round.maxResponseLength), durationSeconds: String(round.durationSeconds) })) };
  if (config.kind === "open-qa") return { kind: config.kind, rounds: config.rounds.map((round) => ({ key: round.key, prompt: round.prompt, options: "", maxResponseLength: "300", durationSeconds: String(round.durationSeconds) })) };
  return null;
}

const toNumber = (value: string) => (value.trim() ? Number(value) : Number.NaN);
const lines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

export function buildAudienceConfiguration(draft: AudienceDraft): unknown {
  return {
    kind: draft.kind,
    rounds: draft.rounds.map((round) => ({
      key: round.key,
      prompt: round.prompt,
      durationSeconds: toNumber(round.durationSeconds),
      ...(draft.kind === "live-poll" ? { options: lines(round.options) } : {}),
      ...(draft.kind === "word-cloud" ? { maxResponseLength: toNumber(round.maxResponseLength) } : {}),
    })),
  };
}

const input = "min-h-9 rounded border border-border bg-background px-2 text-sm";

export function AudienceGameFields({ draft, onChange }: { draft: AudienceDraft; onChange: (draft: AudienceDraft) => void }) {
  const update = (index: number, patch: Partial<AudienceRoundDraft>) => onChange({ ...draft, rounds: draft.rounds.map((round, itemIndex) => itemIndex === index ? { ...round, ...patch } : round) });
  return <div className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">{HELP[draft.kind]}</p>
    {draft.rounds.map((round, index) => <fieldset key={round.key} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Prompt {index + 1}</legend>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Prompt
        <input value={round.prompt} maxLength={500} onChange={(event) => update(index, { prompt: event.target.value })} className={input} />
      </label>
      {draft.kind === "live-poll" ? <label className="grid gap-1 text-xs font-semibold">Options (two to six, one per line)
        <textarea rows={4} value={round.options} onChange={(event) => update(index, { options: event.target.value })} className="rounded border border-border bg-background px-2 py-1 text-sm" />
      </label> : null}
      {draft.kind === "word-cloud" ? <label className="grid gap-1 text-xs font-semibold">Maximum answer length
        <input type="number" min={10} max={60} value={round.maxResponseLength} onChange={(event) => update(index, { maxResponseLength: event.target.value })} className={input} />
      </label> : null}
      <label className="grid gap-1 text-xs font-semibold">Seconds open
        <input type="number" min={5} max={3600} value={round.durationSeconds} onChange={(event) => update(index, { durationSeconds: event.target.value })} className={input} />
      </label>
      {draft.rounds.length > 1 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: draft.rounds.filter((_, itemIndex) => itemIndex !== index) })}>Remove prompt</Button> : null}
    </fieldset>)}
    <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: [...draft.rounds, emptyRound(draft.kind, draft.rounds.length + 1)] })}>Add prompt</Button>
  </div>;
}
