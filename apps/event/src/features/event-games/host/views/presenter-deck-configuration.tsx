import type { PrismEventGameTemplateConfiguration } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { Input } from "@prism/ui/components/input";
import { Textarea } from "@prism/ui/components/textarea";

/** Presenter Deck drafts: each prompt is a choice, rating-scale or word-cloud round. Fields stay strings until the shared schema parses them. */
export type PresenterDeckPromptType = "choice" | "scale" | "word-cloud";
export type PresenterDeckRoundDraft = {
  key: string;
  type: PresenterDeckPromptType;
  prompt: string;
  options: string;
  scaleMax: string;
  maxResponseLength: string;
  durationSeconds: string;
};
export type PresenterDeckDraft = { kind: "presenter-deck"; rounds: PresenterDeckRoundDraft[] };

type PresenterDeckConfiguration = Extract<PrismEventGameTemplateConfiguration, { kind: "presenter-deck" }>;

const MAX_PROMPTS = 30;
/** Native selects styled like the shared Input, so every field in a prompt has the same height. */
const select = "h-10 w-full min-w-0 rounded-md border border-input bg-input-background px-3 text-base text-foreground shadow-xs md:text-sm";
/**
 * Two columns from sm up. Items align to the top so a tall field (the Options textarea) never stretches
 * the Prompt type select beside it; Options always takes its own full-width row.
 */
export const PROMPT_FIELDSET_CLASS = "grid items-start gap-3 rounded-md border border-border p-3 sm:grid-cols-2";

const toNumber = (value: string) => (value.trim() ? Number(value) : Number.NaN);
const lines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

function emptyRound(key: string): PresenterDeckRoundDraft {
  return { key, type: "choice", prompt: "", options: "", scaleMax: "5", maxResponseLength: "30", durationSeconds: "30" };
}

/** Keys must stay unique after removals, so pick the first unused prompt number. */
function nextRoundKey(rounds: PresenterDeckRoundDraft[]): string {
  const taken = new Set(rounds.map((round) => round.key));
  let index = rounds.length + 1;
  while (taken.has(`prompt-${index}`)) index += 1;
  return `prompt-${index}`;
}

export function emptyPresenterDeckDraft(): PresenterDeckDraft {
  return { kind: "presenter-deck", rounds: [emptyRound("prompt-1")] };
}

export function presenterDeckDraftFrom(config: PresenterDeckConfiguration): PresenterDeckDraft {
  return {
    kind: config.kind,
    rounds: config.rounds.map((round) => ({
      key: round.key,
      type: round.type,
      prompt: round.prompt,
      options: round.type === "choice" ? round.options.join("\n") : "",
      scaleMax: round.type === "scale" ? String(round.scaleMax) : "5",
      maxResponseLength: round.type === "word-cloud" ? String(round.maxResponseLength) : "30",
      durationSeconds: String(round.durationSeconds),
    })),
  };
}

export function buildPresenterDeckConfiguration(draft: PresenterDeckDraft): unknown {
  return {
    kind: draft.kind,
    rounds: draft.rounds.map((round) => {
      const shared = { key: round.key, prompt: round.prompt, durationSeconds: toNumber(round.durationSeconds) };
      if (round.type === "choice") return { ...shared, type: "choice", options: lines(round.options) };
      if (round.type === "scale") return { ...shared, type: "scale", scaleMax: toNumber(round.scaleMax) };
      return { ...shared, type: "word-cloud", maxResponseLength: toNumber(round.maxResponseLength) };
    }),
  };
}

export function PresenterDeckFields({ draft, onChange }: { draft: PresenterDeckDraft; onChange: (draft: PresenterDeckDraft) => void }) {
  const update = (index: number, patch: Partial<PresenterDeckRoundDraft>) => onChange({
    ...draft,
    rounds: draft.rounds.map((round, itemIndex) => itemIndex === index ? { ...round, ...patch } : round),
  });
  return <div className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Each prompt is multiple choice, a rating scale or a word cloud. Guests answer one prompt at a time. Pause a prompt to show its results.</p>
    {draft.rounds.map((round, index) => <fieldset key={round.key} className={PROMPT_FIELDSET_CLASS}>
      <legend className="px-1 text-sm font-semibold">Prompt {index + 1}</legend>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Prompt
        <Input value={round.prompt} maxLength={500} onChange={(event) => update(index, { prompt: event.target.value })} />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Prompt type
        <select value={round.type} onChange={(event) => update(index, { type: event.target.value as PresenterDeckPromptType })} className={select}>
          <option value="choice">Multiple choice</option>
          <option value="scale">Rating scale</option>
          <option value="word-cloud">Word cloud</option>
        </select>
      </label>
      {round.type === "scale" ? <label className="grid gap-1 text-xs font-semibold">Rating scale maximum
        <select value={round.scaleMax} onChange={(event) => update(index, { scaleMax: event.target.value })} className={select}>
          <option value="5">1 to 5</option>
          <option value="10">1 to 10</option>
        </select>
      </label> : null}
      {round.type === "word-cloud" ? <label className="grid gap-1 text-xs font-semibold">Maximum answer length
        <Input type="number" min={10} max={60} value={round.maxResponseLength} onChange={(event) => update(index, { maxResponseLength: event.target.value })} />
      </label> : null}
      <label className="grid gap-1 text-xs font-semibold">Seconds open
        <Input type="number" min={5} max={600} value={round.durationSeconds} onChange={(event) => update(index, { durationSeconds: event.target.value })} />
      </label>
      {round.type === "choice" ? <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Options (two to six, one per line)
        <Textarea rows={4} value={round.options} onChange={(event) => update(index, { options: event.target.value })} />
      </label> : null}
      {draft.rounds.length > 1 ? <Button type="button" size="sm" variant="outline" className="sm:col-span-2 sm:justify-self-start" onClick={() => onChange({ ...draft, rounds: draft.rounds.filter((_, itemIndex) => itemIndex !== index) })}>Remove prompt</Button> : null}
    </fieldset>)}
    {draft.rounds.length < MAX_PROMPTS ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: [...draft.rounds, emptyRound(nextRoundKey(draft.rounds))] })}>Add prompt</Button> : null}
  </div>;
}
