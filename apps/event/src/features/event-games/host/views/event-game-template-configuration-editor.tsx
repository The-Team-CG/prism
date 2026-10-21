"use client";

import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import {
  eventGameTemplateConfigurationSchema,
  type PrismEventGameDefinition,
  type PrismEventGameTemplateConfiguration,
} from "@prism/types";
import { Button } from "@/app/components/ui/button";

type TriviaRoundDraft = {
  key: string;
  prompt: string;
  options: string;
  correctAnswer: string;
  points: string;
  durationSeconds: string;
  speedBonusPoints: string;
};

type ChoiceRoundDraft = { key: string; prompt: string; options: string; durationSeconds: string };
type WouldYouRatherRoundDraft = ChoiceRoundDraft & { aggregateResults: boolean };
type FeudTeamDraft = { id: string; label: string };
type FeudRoundDraft = { key: string; prompt: string; durationSeconds: string; answers: string };
type SplitRoundDraft = {
  key: string; prompt: string; leftLabel: string; rightLabel: string; maxResponseLength: string; durationSeconds: string;
};
type PictureStageDraft = { afterSeconds: string; hint: string; points: string };
type WheelOutcomeDraft = { id: string; label: string; weight: string; points: string; eligible: boolean };
type WordScrambleRoundDraft = { key: string; scrambledWord: string; answer: string; points: string; durationSeconds: string };
type PictureSoloRoundDraft = { key: string; mediaObjectId: string; acceptedAnswers: string; stages: string; durationSeconds: string };
type DifferenceRoundDraft = { key: string; originalMediaObjectId: string; comparisonMediaObjectId: string; differences: string; durationSeconds: string };
type ConfigurationDraftSetter = Dispatch<SetStateAction<ConfigurationDraft | null>>;
type UploadMedia = (file: File, onUploaded: (objectId: string) => void) => void;

type ConfigurationDraft =
  | { kind: "live-trivia"; rounds: TriviaRoundDraft[] }
  | { kind: "bingo"; callSequence: string; callIntervalSeconds: string; winPattern: "line" | "full-card"; points: string }
  | { kind: "guess-picture"; mediaObjectId: string; acceptedAnswers: string; stages: PictureStageDraft[] }
  | { kind: "spin-wheel"; outcomes: WheelOutcomeDraft[] }
  | { kind: "this-or-that"; rounds: ChoiceRoundDraft[] }
  | { kind: "would-you-rather"; rounds: WouldYouRatherRoundDraft[] }
  | { kind: "this-or-that-solo"; rounds: ChoiceRoundDraft[] }
  | { kind: "family-feud"; teams: FeudTeamDraft[]; rounds: FeudRoundDraft[] }
  | { kind: "split-the-room"; rounds: SplitRoundDraft[] }
  | { kind: "word-scramble"; rounds: WordScrambleRoundDraft[] }
  | { kind: "guess-picture-solo"; rounds: PictureSoloRoundDraft[] }
  | { kind: "spot-the-difference"; rounds: DifferenceRoundDraft[] };

type Props = {
  game: PrismEventGameDefinition;
  busy: boolean;
  onSave: (configuration: PrismEventGameTemplateConfiguration) => Promise<unknown>;
  onUploadMedia: (file: File) => Promise<{ objectId: string }>;
};

const CONFIGURABLE_TEMPLATES = new Set([
  "live-trivia", "bingo", "guess-picture", "spin-wheel", "this-or-that", "family-feud", "split-the-room",
  "word-scramble", "would-you-rather", "guess-picture-solo", "this-or-that-solo", "spot-the-difference",
]);

const INITIAL_TEAM_IDS = [
  "a78bde2c-61a4-4e5f-b9ba-dbe21ca203b5",
  "a78bde2c-61a4-4e5f-b9ba-dbe21ca203b6",
];

function splitAnswers(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function splitCommaSeparated(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function numberOrNaN(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function toDraft(game: PrismEventGameDefinition): ConfigurationDraft | null {
  if (!CONFIGURABLE_TEMPLATES.has(game.kind)) return null;
  const current = eventGameTemplateConfigurationSchema.safeParse(game.config?.configuration);
  if (current.success && current.data.kind === game.kind) return configurationDraft(current.data);
  return emptyDraft(game.kind);
}

function configurationDraft(config: PrismEventGameTemplateConfiguration): ConfigurationDraft | null {
  const singleplayerDraft = singleplayerConfigurationDraft(config);
  if (singleplayerDraft) return singleplayerDraft;
  if (config.kind === "live-trivia") return { kind: config.kind, rounds: config.rounds.map((round) => ({
    key: round.key,
    prompt: round.prompt,
    options: round.options.join("\n"),
    correctAnswer: round.correctAnswer,
    points: String(round.points),
    durationSeconds: String(round.durationSeconds),
    speedBonusPoints: round.speedBonusPoints === undefined ? "" : String(round.speedBonusPoints),
  })) };
  if (config.kind === "bingo") return {
    kind: config.kind,
    callSequence: config.callSequence.join(", "),
    callIntervalSeconds: String(config.callIntervalSeconds),
    winPattern: config.winPattern,
    points: String(config.points),
  };
  if (config.kind === "guess-picture") return {
    kind: config.kind,
    mediaObjectId: config.mediaObjectId,
    acceptedAnswers: config.acceptedAnswers.join(", "),
    stages: config.stages.map((stage) => ({
      afterSeconds: String(stage.afterSeconds), hint: stage.hint, points: String(stage.points),
    })),
  };
  if (config.kind === "spin-wheel") return { kind: config.kind, outcomes: config.outcomes.map((outcome) => ({
    ...outcome,
    weight: String(outcome.weight),
    points: String(outcome.points),
  })) };
  if (config.kind === "this-or-that") return { kind: config.kind, rounds: config.rounds.map((round) => ({
    key: round.key, prompt: round.prompt, options: round.options.join("\n"), durationSeconds: String(round.durationSeconds),
  })) };
  if (config.kind === "family-feud") return {
    kind: config.kind,
    teams: config.teams.map(({ id, label }) => ({ id, label })),
    rounds: config.rounds.map((round) => ({
      key: round.key,
      prompt: round.prompt,
      durationSeconds: String(round.durationSeconds),
      answers: round.answers.map(({ answer, alternatives, points }) => `${answer} | ${alternatives.join(", ")} | ${points}`).join("\n"),
    })),
  };
  if (config.kind === "split-the-room") return { kind: config.kind, rounds: config.rounds.map((round) => ({
    key: round.key,
    prompt: round.prompt,
    leftLabel: round.leftLabel,
    rightLabel: round.rightLabel,
    maxResponseLength: String(round.maxResponseLength),
    durationSeconds: String(round.durationSeconds),
  })) };
  return null;
}

function singleplayerConfigurationDraft(config: PrismEventGameTemplateConfiguration): ConfigurationDraft | null {
  if (config.kind === "would-you-rather") return { kind: config.kind, rounds: config.rounds.map((round) => ({
    key: round.key, prompt: round.prompt, options: round.options.join("\n"),
    durationSeconds: String(round.durationSeconds), aggregateResults: round.aggregateResults,
  })) };
  if (config.kind === "this-or-that-solo") return { kind: config.kind, rounds: config.rounds.map((round) => ({
    key: round.key, prompt: round.prompt, options: round.options.join("\n"), durationSeconds: String(round.durationSeconds),
  })) };
  if (config.kind === "word-scramble") return { kind: config.kind, rounds: config.rounds.map((round) => ({
    key: round.key, scrambledWord: round.scrambledWord, answer: round.answer,
    points: String(round.points), durationSeconds: String(round.durationSeconds),
  })) };
  if (config.kind === "guess-picture-solo") return { kind: config.kind, rounds: config.rounds.map((round) => ({
    key: round.key,
    mediaObjectId: round.mediaObjectId,
    acceptedAnswers: round.acceptedAnswers.join(", "),
    stages: round.stages.map((stage) => `${stage.afterSeconds} | ${stage.hint} | ${stage.points}`).join("\n"),
    durationSeconds: String(round.durationSeconds),
  })) };
  if (config.kind === "spot-the-difference") return { kind: config.kind, rounds: config.rounds.map((round) => ({
    key: round.key,
    originalMediaObjectId: round.originalMediaObjectId,
    comparisonMediaObjectId: round.comparisonMediaObjectId,
    differences: round.differences.map((region) => `${region.x}, ${region.y}, ${region.width}, ${region.height}, ${region.points}`).join("\n"),
    durationSeconds: String(round.durationSeconds),
  })) };
  return null;
}

function emptyDraft(kind: PrismEventGameDefinition["kind"]): ConfigurationDraft | null {
  const singleplayerDraft = emptySingleplayerDraft(kind);
  if (singleplayerDraft) return singleplayerDraft;
  if (kind === "live-trivia") return { kind, rounds: [{
    key: "round-1", prompt: "", options: "", correctAnswer: "", points: "10", durationSeconds: "30", speedBonusPoints: "",
  }] };
  if (kind === "bingo") return { kind, callSequence: "", callIntervalSeconds: "10", winPattern: "line", points: "100" };
  if (kind === "guess-picture") return {
    kind, mediaObjectId: "", acceptedAnswers: "", stages: [{ afterSeconds: "0", hint: "", points: "100" }],
  };
  if (kind === "spin-wheel") return { kind, outcomes: [
    { id: "outcome-1", label: "", weight: "1", points: "0", eligible: true },
    { id: "outcome-2", label: "", weight: "1", points: "0", eligible: true },
  ] };
  if (kind === "this-or-that") return { kind, rounds: [
    { key: "round-1", prompt: "", options: "", durationSeconds: "30" },
  ] };
  if (kind === "family-feud") return {
    kind,
    teams: [{ id: INITIAL_TEAM_IDS[0]!, label: "Blue" }, { id: INITIAL_TEAM_IDS[1]!, label: "Gold" }],
    rounds: [{ key: "round-1", prompt: "", durationSeconds: "60", answers: "" }],
  };
  if (kind === "split-the-room") return { kind, rounds: [
    { key: "round-1", prompt: "", leftLabel: "Left", rightLabel: "Right", maxResponseLength: "160", durationSeconds: "60" },
  ] };
  return null;
}

function emptySingleplayerDraft(kind: PrismEventGameDefinition["kind"]): ConfigurationDraft | null {
  if (kind === "would-you-rather") return { kind, rounds: [
    { key: "rather-1", prompt: "", options: "", durationSeconds: "30", aggregateResults: false },
  ] };
  if (kind === "this-or-that-solo") return { kind, rounds: [
    { key: "choice-1", prompt: "", options: "", durationSeconds: "30" },
  ] };
  if (kind === "word-scramble") return { kind, rounds: [
    { key: "word-1", scrambledWord: "", answer: "", points: "10", durationSeconds: "45" },
  ] };
  if (kind === "guess-picture-solo") return { kind, rounds: [
    { key: "picture-1", mediaObjectId: "", acceptedAnswers: "", stages: "0 | First hint | 20", durationSeconds: "60" },
  ] };
  if (kind === "spot-the-difference") return { kind, rounds: [
    { key: "difference-1", originalMediaObjectId: "", comparisonMediaObjectId: "", differences: "0.2, 0.2, 0.1, 0.1, 10", durationSeconds: "90" },
  ] };
  return null;
}

function buildConfiguration(draft: ConfigurationDraft): unknown {
  const socialSingleplayer = buildSocialSingleplayerConfiguration(draft);
  if (socialSingleplayer) return socialSingleplayer;
  const puzzleSingleplayer = buildPuzzleSingleplayerConfiguration(draft);
  if (puzzleSingleplayer) return puzzleSingleplayer;
  if (draft.kind === "live-trivia") return {
    kind: draft.kind,
    rounds: draft.rounds.map((round) => ({
      key: round.key,
      prompt: round.prompt,
      options: splitAnswers(round.options),
      correctAnswer: round.correctAnswer,
      points: numberOrNaN(round.points),
      durationSeconds: numberOrNaN(round.durationSeconds),
      ...(round.speedBonusPoints.trim() ? { speedBonusPoints: numberOrNaN(round.speedBonusPoints) } : {}),
    })),
  };
  if (draft.kind === "bingo") return {
    kind: draft.kind,
    callSequence: splitCommaSeparated(draft.callSequence).map(Number),
    callIntervalSeconds: numberOrNaN(draft.callIntervalSeconds),
    winPattern: draft.winPattern,
    points: numberOrNaN(draft.points),
  };
  if (draft.kind === "guess-picture") return {
    kind: draft.kind,
    mediaObjectId: draft.mediaObjectId.trim(),
    acceptedAnswers: splitCommaSeparated(draft.acceptedAnswers),
    stages: draft.stages.map((stage) => ({
      afterSeconds: numberOrNaN(stage.afterSeconds),
      hint: stage.hint,
      points: numberOrNaN(stage.points),
    })),
  };
  if (draft.kind === "spin-wheel") return {
    kind: draft.kind,
    outcomes: draft.outcomes.map((outcome) => ({
      ...outcome,
      weight: numberOrNaN(outcome.weight),
      points: numberOrNaN(outcome.points),
    })),
  };
  if (draft.kind === "this-or-that") return {
    kind: draft.kind,
    rounds: draft.rounds.map((round) => ({
      key: round.key,
      prompt: round.prompt,
      options: splitAnswers(round.options),
      durationSeconds: numberOrNaN(round.durationSeconds),
    })),
  };
  if (draft.kind === "family-feud") return {
    kind: draft.kind,
    teams: draft.teams,
    rounds: draft.rounds.map((round) => ({
      key: round.key,
      prompt: round.prompt,
      durationSeconds: numberOrNaN(round.durationSeconds),
      answers: splitAnswers(round.answers).map((line) => {
        const [answer = "", alternatives = "", points = ""] = line.split("|").map((item) => item.trim());
        return { answer, alternatives: splitCommaSeparated(alternatives), points: numberOrNaN(points) };
      }),
    })),
  };
  if (draft.kind === "split-the-room") return {
    kind: draft.kind,
    rounds: draft.rounds.map((round) => ({
      key: round.key,
      prompt: round.prompt,
      leftLabel: round.leftLabel,
      rightLabel: round.rightLabel,
      maxResponseLength: numberOrNaN(round.maxResponseLength),
      durationSeconds: numberOrNaN(round.durationSeconds),
    })),
  };
  return null;
}

function buildPuzzleSingleplayerConfiguration(draft: ConfigurationDraft): unknown | null {
  if (draft.kind === "word-scramble") return {
    kind: draft.kind,
    rounds: draft.rounds.map((round) => ({
      key: round.key, scrambledWord: round.scrambledWord, answer: round.answer,
      points: numberOrNaN(round.points), durationSeconds: numberOrNaN(round.durationSeconds),
    })),
  };
  if (draft.kind === "guess-picture-solo") return {
    kind: draft.kind,
    rounds: draft.rounds.map((round) => ({
      key: round.key,
      mediaObjectId: round.mediaObjectId.trim(),
      acceptedAnswers: splitCommaSeparated(round.acceptedAnswers),
      stages: splitAnswers(round.stages).map((line) => {
        const [afterSeconds = "", hint = "", points = ""] = line.split("|").map((item) => item.trim());
        return { afterSeconds: numberOrNaN(afterSeconds), hint, points: numberOrNaN(points) };
      }),
      durationSeconds: numberOrNaN(round.durationSeconds),
    })),
  };
  if (draft.kind === "spot-the-difference") return {
    kind: draft.kind,
    rounds: draft.rounds.map((round) => ({
      key: round.key,
      originalMediaObjectId: round.originalMediaObjectId.trim(),
      comparisonMediaObjectId: round.comparisonMediaObjectId.trim(),
      differences: splitAnswers(round.differences).map((line) => {
        const [x = "", y = "", width = "", height = "", points = ""] = line.split(",").map((item) => item.trim());
        return { x: numberOrNaN(x), y: numberOrNaN(y), width: numberOrNaN(width), height: numberOrNaN(height), points: numberOrNaN(points) };
      }),
      durationSeconds: numberOrNaN(round.durationSeconds),
    })),
  };
  return null;
}

function buildSocialSingleplayerConfiguration(draft: ConfigurationDraft): unknown | null {
  if (draft.kind === "would-you-rather") return {
    kind: draft.kind,
    rounds: draft.rounds.map((round) => ({
      key: round.key, prompt: round.prompt, options: splitAnswers(round.options),
      durationSeconds: numberOrNaN(round.durationSeconds), aggregateResults: round.aggregateResults,
    })),
  };
  if (draft.kind === "this-or-that-solo") return {
    kind: draft.kind,
    rounds: draft.rounds.map((round) => ({
      key: round.key, prompt: round.prompt, options: splitAnswers(round.options),
      durationSeconds: numberOrNaN(round.durationSeconds),
    })),
  };
  return null;
}

export function EventGameTemplateConfigurationEditor({ game, busy, onSave, onUploadMedia }: Props) {
  const [draft, setDraft] = useState(() => toDraft(game));
  const [error, setError] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  useEffect(() => {
    setDraft(toDraft(game));
    setError(null);
  }, [game.id, game.version, game.config]);

  function uploadMedia(file: File, onUploaded: (objectId: string) => void) {
    setUploadingMedia(true);
    setError(null);
    void onUploadMedia(file)
      .then(({ objectId }) => onUploaded(objectId))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The game image could not be uploaded. Try again."))
      .finally(() => setUploadingMedia(false));
  }

  if (!draft) return null;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const result = eventGameTemplateConfigurationSchema.safeParse(buildConfiguration(draft));
    if (!result.success || result.data.kind !== game.kind) {
      setError("Complete the required fields and check the values for this game template.");
      return;
    }
    setError(null);
    void onSave(result.data);
  }

  return (
    <form className="mt-4 rounded-md border border-border bg-card p-4" onSubmit={save} aria-label={`${game.title} template configuration`}>
      <h5 className="font-bold">Template configuration</h5>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">These settings are saved to this event’s draft. Publishing and session start revalidate them on the server.</p>
      {draft.kind === "live-trivia" ? (
        <div className="mt-3 space-y-3">
          {draft.rounds.map((round, index) => (
            <fieldset key={round.key} className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-2">
              <legend className="px-1 text-sm font-semibold">Question {index + 1}</legend>
              <label className="grid gap-1 text-xs font-semibold md:col-span-2">Prompt
                <input value={round.prompt} maxLength={500} onChange={(event) => setDraft({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold">Answer choices (one per line)
                <textarea rows={3} value={round.options} onChange={(event) => setDraft({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value } : item) })} className="rounded border border-border bg-background px-2 py-1 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold">Correct answer
                <input value={round.correctAnswer} maxLength={120} onChange={(event) => setDraft({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, correctAnswer: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold">Points
                <input type="number" min={0} max={100000} value={round.points} onChange={(event) => setDraft({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, points: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold">Seconds per question
                <input type="number" min={5} max={600} value={round.durationSeconds} onChange={(event) => setDraft({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold">Optional maximum speed bonus
                <input type="number" min={0} max={100000} value={round.speedBonusPoints} onChange={(event) => setDraft({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, speedBonusPoints: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
              </label>
              {draft.rounds.length > 1 ? <Button type="button" size="sm" variant="outline" className="md:col-span-2 md:justify-self-start" onClick={() => setDraft({ ...draft, rounds: draft.rounds.filter((_, itemIndex) => itemIndex !== index) })}>Remove question</Button> : null}
            </fieldset>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, rounds: [...draft.rounds, { key: `round-${draft.rounds.length + 1}`, prompt: "", options: "", correctAnswer: "", points: "10", durationSeconds: "30", speedBonusPoints: "" }] })}>Add question</Button>
        </div>
      ) : null}

      {draft.kind === "bingo" ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Call sequence (24–75 unique numbers, comma-separated)
          <input value={draft.callSequence} onChange={(event) => setDraft({ ...draft, callSequence: event.target.value })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-semibold">Seconds between calls
          <input type="number" min={5} max={120} value={draft.callIntervalSeconds} onChange={(event) => setDraft({ ...draft, callIntervalSeconds: event.target.value })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
        </label>
        <label className="grid gap-1 text-xs font-semibold">Winning pattern
          <select value={draft.winPattern} onChange={(event) => setDraft({ ...draft, winPattern: event.target.value as "line" | "full-card" })} className="min-h-9 rounded border border-border bg-background px-2 text-sm"><option value="line">Any line</option><option value="full-card">Full card</option></select>
        </label>
        <label className="grid gap-1 text-xs font-semibold">Points for a verified win
          <input type="number" min={0} max={100000} value={draft.points} onChange={(event) => setDraft({ ...draft, points: event.target.value })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
        </label>
      </div> : null}

      {draft.kind === "guess-picture" ? <div className="mt-3 space-y-3">
        <GameMediaUploadField
          label="Picture image"
          busy={busy || uploadingMedia}
          attached={Boolean(draft.mediaObjectId)}
          onFile={(file) => uploadMedia(file, (mediaObjectId) => setDraft((current) =>
            current?.kind === "guess-picture" ? { ...current, mediaObjectId } : current))}
        />
        <label className="grid gap-1 text-xs font-semibold">Accepted answers (comma-separated)
          <input value={draft.acceptedAnswers} onChange={(event) => setDraft({ ...draft, acceptedAnswers: event.target.value })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
        </label>
        {draft.stages.map((stage, index) => <fieldset key={index} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-3">
          <legend className="px-1 text-xs font-semibold">Reveal stage {index + 1}</legend>
          <label className="grid gap-1 text-xs font-semibold">After seconds<input type="number" min={0} max={3600} value={stage.afterSeconds} onChange={(event) => setDraft({ ...draft, stages: draft.stages.map((item, itemIndex) => itemIndex === index ? { ...item, afterSeconds: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Hint<input value={stage.hint} onChange={(event) => setDraft({ ...draft, stages: draft.stages.map((item, itemIndex) => itemIndex === index ? { ...item, hint: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-semibold">Points<input type="number" min={0} max={100000} value={stage.points} onChange={(event) => setDraft({ ...draft, stages: draft.stages.map((item, itemIndex) => itemIndex === index ? { ...item, points: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
          {draft.stages.length > 1 ? <Button type="button" size="sm" variant="outline" className="sm:col-span-3 sm:justify-self-start" onClick={() => setDraft({ ...draft, stages: draft.stages.filter((_, itemIndex) => itemIndex !== index) })}>Remove stage</Button> : null}
        </fieldset>)}
        <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, stages: [...draft.stages, { afterSeconds: "30", hint: "", points: "50" }] })}>Add reveal stage</Button>
      </div> : null}

      {draft.kind === "spin-wheel" ? <div className="mt-3 space-y-3">
        {draft.outcomes.map((outcome, index) => <fieldset key={outcome.id} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
          <legend className="px-1 text-xs font-semibold">Outcome {index + 1}</legend>
          <label className="grid gap-1 text-xs font-semibold">Outcome ID<input value={outcome.id} onChange={(event) => setDraft({ ...draft, outcomes: draft.outcomes.map((item, itemIndex) => itemIndex === index ? { ...item, id: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-semibold">Label<input value={outcome.label} onChange={(event) => setDraft({ ...draft, outcomes: draft.outcomes.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-semibold">Selection weight<input type="number" min={1} max={100000} value={outcome.weight} onChange={(event) => setDraft({ ...draft, outcomes: draft.outcomes.map((item, itemIndex) => itemIndex === index ? { ...item, weight: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
          <label className="grid gap-1 text-xs font-semibold">Points<input type="number" min={0} max={100000} value={outcome.points} onChange={(event) => setDraft({ ...draft, outcomes: draft.outcomes.map((item, itemIndex) => itemIndex === index ? { ...item, points: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-xs font-semibold sm:col-span-2"><input type="checkbox" checked={outcome.eligible} onChange={(event) => setDraft({ ...draft, outcomes: draft.outcomes.map((item, itemIndex) => itemIndex === index ? { ...item, eligible: event.target.checked } : item) })} />Eligible for selection</label>
          {draft.outcomes.length > 2 ? <Button type="button" size="sm" variant="outline" className="sm:col-span-2 sm:justify-self-start" onClick={() => setDraft({ ...draft, outcomes: draft.outcomes.filter((_, itemIndex) => itemIndex !== index) })}>Remove outcome</Button> : null}
        </fieldset>)}
        <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, outcomes: [...draft.outcomes, { id: `outcome-${draft.outcomes.length + 1}`, label: "", weight: "1", points: "0", eligible: true }] })}>Add outcome</Button>
      </div> : null}

      {isExtendedTemplateDraft(draft) ? <ExtendedTemplateFields
        draft={draft}
        onChange={setDraft}
        onUploadMedia={uploadMedia}
        mediaBusy={busy || uploadingMedia}
      /> : null}

      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
      <Button type="submit" size="sm" className="mt-4" disabled={busy}>Save template configuration</Button>
    </form>
  );
}

type ThisOrThatDraft = Extract<ConfigurationDraft, { kind: "this-or-that" }>;
type WouldYouRatherDraft = Extract<ConfigurationDraft, { kind: "would-you-rather" }>;
type ThisOrThatSoloDraft = Extract<ConfigurationDraft, { kind: "this-or-that-solo" }>;
type FamilyFeudDraft = Extract<ConfigurationDraft, { kind: "family-feud" }>;
type SplitTheRoomDraft = Extract<ConfigurationDraft, { kind: "split-the-room" }>;
type WordScrambleDraft = Extract<ConfigurationDraft, { kind: "word-scramble" }>;
type PictureSoloDraft = Extract<ConfigurationDraft, { kind: "guess-picture-solo" }>;
type DifferenceDraft = Extract<ConfigurationDraft, { kind: "spot-the-difference" }>;
type ExtendedTemplateDraft = Extract<ConfigurationDraft, {
  kind: "this-or-that" | "would-you-rather" | "this-or-that-solo" | "family-feud" | "split-the-room" | "word-scramble" | "guess-picture-solo" | "spot-the-difference";
}>;

const EXTENDED_TEMPLATE_KINDS = new Set([
  "this-or-that", "would-you-rather", "this-or-that-solo", "family-feud", "split-the-room", "word-scramble", "guess-picture-solo", "spot-the-difference",
]);

function isExtendedTemplateDraft(draft: ConfigurationDraft): draft is ExtendedTemplateDraft {
  return EXTENDED_TEMPLATE_KINDS.has(draft.kind);
}

function ExtendedTemplateFields({ draft, onChange, onUploadMedia, mediaBusy }: {
  draft: ExtendedTemplateDraft;
  onChange: ConfigurationDraftSetter;
  onUploadMedia: UploadMedia;
  mediaBusy: boolean;
}) {
  return <>
    {draft.kind === "this-or-that" ? <ThisOrThatFields draft={draft} onChange={(next) => onChange(next)} /> : null}
    {draft.kind === "would-you-rather" ? <WouldYouRatherFields draft={draft} onChange={(next) => onChange(next)} /> : null}
    {draft.kind === "this-or-that-solo" ? <ThisOrThatSoloFields draft={draft} onChange={(next) => onChange(next)} /> : null}
    {draft.kind === "family-feud" ? <FamilyFeudFields draft={draft} onChange={(next) => onChange(next)} /> : null}
    {draft.kind === "split-the-room" ? <SplitTheRoomFields draft={draft} onChange={(next) => onChange(next)} /> : null}
    {draft.kind === "word-scramble" ? <WordScrambleFields draft={draft} onChange={(next) => onChange(next)} /> : null}
    {draft.kind === "guess-picture-solo" ? <PictureSoloFields draft={draft} onChange={onChange} onUploadMedia={onUploadMedia} mediaBusy={mediaBusy} /> : null}
    {draft.kind === "spot-the-difference" ? <SpotTheDifferenceFields draft={draft} onChange={onChange} onUploadMedia={onUploadMedia} mediaBusy={mediaBusy} /> : null}
  </>;
}

function GameMediaUploadField({ label, attached, busy, onFile }: {
  label: string;
  attached: boolean;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  return <label className="grid gap-1 text-xs font-semibold">
    {label} (PNG or JPEG, up to 8 MB)
    <input
      type="file"
      accept="image/png,image/jpeg"
      disabled={busy}
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (file) onFile(file);
      }}
      className="min-h-9 rounded border border-border bg-background px-2 py-1 text-sm"
    />
    <span role="status" className="font-normal text-muted-foreground">{attached ? "Image uploaded" : "No image uploaded"}</span>
  </label>;
}

function WouldYouRatherFields({ draft, onChange }: { draft: WouldYouRatherDraft; onChange: (draft: WouldYouRatherDraft) => void }) {
  return <div className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Would You Rather is private by default. Organizers can allow anonymous event poll totals for a question.</p>
    {draft.rounds.map((round, index) => <fieldset key={round.key} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Would you rather question {index + 1}</legend>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Prompt
        <input value={round.prompt} maxLength={500} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Choices (exactly two, one per line)
        <textarea rows={2} value={round.options} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value } : item) })} className="rounded border border-border bg-background px-2 py-1 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Seconds to choose
        <input type="number" min={5} max={600} value={round.durationSeconds} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-xs font-semibold sm:col-span-2">
        <input type="checkbox" checked={round.aggregateResults} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, aggregateResults: event.target.checked } : item) })} />
        Allow anonymous event poll totals
      </label>
      {draft.rounds.length > 1 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: draft.rounds.filter((_, itemIndex) => itemIndex !== index) })}>Remove question</Button> : null}
    </fieldset>)}
    <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: [...draft.rounds, { key: `rather-${draft.rounds.length + 1}`, prompt: "", options: "", durationSeconds: "30", aggregateResults: false }] })}>Add question</Button>
  </div>;
}

function ThisOrThatSoloFields({ draft, onChange }: { draft: ThisOrThatSoloDraft; onChange: (draft: ThisOrThatSoloDraft) => void }) {
  return <div className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Private This or That (Solo). Guests choose whether to share each answer in the event poll.</p>
    {draft.rounds.map((round, index) => <fieldset key={round.key} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Question {index + 1}</legend>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Prompt
        <input value={round.prompt} maxLength={500} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Choices (exactly two, one per line)
        <textarea rows={2} value={round.options} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value } : item) })} className="rounded border border-border bg-background px-2 py-1 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Seconds to choose
        <input type="number" min={5} max={600} value={round.durationSeconds} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      {draft.rounds.length > 1 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: draft.rounds.filter((_, itemIndex) => itemIndex !== index) })}>Remove question</Button> : null}
    </fieldset>)}
    <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: [...draft.rounds, { key: `choice-${draft.rounds.length + 1}`, prompt: "", options: "", durationSeconds: "30" }] })}>Add question</Button>
  </div>;
}

function WordScrambleFields({ draft, onChange }: { draft: WordScrambleDraft; onChange: (draft: WordScrambleDraft) => void }) {
  return <div className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Guests see the scrambled word. Answers are checked and scored by the server.</p>
    {draft.rounds.map((round, index) => <fieldset key={round.key} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Puzzle {index + 1}</legend>
      <label className="grid gap-1 text-xs font-semibold">Scrambled word<input value={round.scrambledWord} maxLength={120} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, scrambledWord: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
      <label className="grid gap-1 text-xs font-semibold">Answer key (not shown to guests)<input value={round.answer} maxLength={120} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, answer: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
      <label className="grid gap-1 text-xs font-semibold">Points<input type="number" min={0} max={100000} value={round.points} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, points: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
      <label className="grid gap-1 text-xs font-semibold">Seconds to solve<input type="number" min={5} max={600} value={round.durationSeconds} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
      {draft.rounds.length > 1 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: draft.rounds.filter((_, itemIndex) => itemIndex !== index) })}>Remove puzzle</Button> : null}
    </fieldset>)}
    {draft.rounds.length < 30 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: [...draft.rounds, { key: `word-${draft.rounds.length + 1}`, scrambledWord: "", answer: "", points: "10", durationSeconds: "45" }] })}>Add puzzle</Button> : null}
  </div>;
}

function PictureSoloFields({ draft, onChange, onUploadMedia, mediaBusy }: {
  draft: PictureSoloDraft;
  onChange: ConfigurationDraftSetter;
  onUploadMedia: UploadMedia;
  mediaBusy: boolean;
}) {
  return <div className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Each guest gets a private reveal and score. Add one `seconds | hint | points` reveal per line; hints and images are delivered only for the current round.</p>
    {draft.rounds.map((round, index) => <fieldset key={round.key} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Picture puzzle {index + 1}</legend>
      <div className="sm:col-span-2">
        <GameMediaUploadField
          label="Picture image"
          attached={Boolean(round.mediaObjectId)}
          busy={mediaBusy}
          onFile={(file) => onUploadMedia(file, (mediaObjectId) => onChange((current) =>
            current?.kind === "guess-picture-solo" ? {
              ...current,
              rounds: current.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, mediaObjectId } : item),
            } : current))}
        />
      </div>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Accepted answers (comma-separated)<input value={round.acceptedAnswers} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, acceptedAnswers: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Reveal hint schedule (seconds | hint | points, one per line)<textarea rows={3} value={round.stages} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, stages: event.target.value } : item) })} className="rounded border border-border bg-background px-2 py-1 text-sm" /></label>
      <label className="grid gap-1 text-xs font-semibold">Seconds to solve<input type="number" min={5} max={600} value={round.durationSeconds} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
      {draft.rounds.length > 1 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: draft.rounds.filter((_, itemIndex) => itemIndex !== index) })}>Remove picture puzzle</Button> : null}
    </fieldset>)}
    {draft.rounds.length < 20 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: [...draft.rounds, { key: `picture-${draft.rounds.length + 1}`, mediaObjectId: "", acceptedAnswers: "", stages: "0 | First hint | 20", durationSeconds: "60" }] })}>Add picture puzzle</Button> : null}
  </div>;
}

function SpotTheDifferenceFields({ draft, onChange, onUploadMedia, mediaBusy }: {
  draft: DifferenceDraft;
  onChange: ConfigurationDraftSetter;
  onUploadMedia: UploadMedia;
  mediaBusy: boolean;
}) {
  return <div className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Guests see the image pair and total number of differences only. Enter one hidden target region per line as `x, y, width, height, points`; coordinates use the 0–1 image scale.</p>
    {draft.rounds.map((round, index) => <fieldset key={round.key} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Image pair {index + 1}</legend>
      <GameMediaUploadField
        label="Original image"
        attached={Boolean(round.originalMediaObjectId)}
        busy={mediaBusy}
        onFile={(file) => onUploadMedia(file, (originalMediaObjectId) => onChange((current) =>
          current?.kind === "spot-the-difference" ? {
            ...current,
            rounds: current.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, originalMediaObjectId } : item),
          } : current))}
      />
      <GameMediaUploadField
        label="Comparison image"
        attached={Boolean(round.comparisonMediaObjectId)}
        busy={mediaBusy}
        onFile={(file) => onUploadMedia(file, (comparisonMediaObjectId) => onChange((current) =>
          current?.kind === "spot-the-difference" ? {
            ...current,
            rounds: current.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, comparisonMediaObjectId } : item),
          } : current))}
      />
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Target regions (x, y, width, height, points)<textarea rows={4} value={round.differences} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, differences: event.target.value } : item) })} className="rounded border border-border bg-background px-2 py-1 text-sm" /></label>
      <label className="grid gap-1 text-xs font-semibold">Seconds to find them<input type="number" min={5} max={600} value={round.durationSeconds} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" /></label>
      {draft.rounds.length > 1 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: draft.rounds.filter((_, itemIndex) => itemIndex !== index) })}>Remove image pair</Button> : null}
    </fieldset>)}
    {draft.rounds.length < 20 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: [...draft.rounds, { key: `difference-${draft.rounds.length + 1}`, originalMediaObjectId: "", comparisonMediaObjectId: "", differences: "0.2, 0.2, 0.1, 0.1, 10", durationSeconds: "90" }] })}>Add image pair</Button> : null}
  </div>;
}

function ThisOrThatFields({ draft, onChange }: { draft: ThisOrThatDraft; onChange: (draft: ThisOrThatDraft) => void }) {
  return <div className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Each round has two choices. Guests vote once; only combined totals are shown.</p>
    {draft.rounds.map((round, index) => <fieldset key={round.key} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Question {index + 1}</legend>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Prompt
        <input value={round.prompt} maxLength={500} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Choices (exactly two, one per line)
        <textarea rows={2} value={round.options} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value } : item) })} className="rounded border border-border bg-background px-2 py-1 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Seconds for voting
        <input type="number" min={5} max={600} value={round.durationSeconds} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      {draft.rounds.length > 1 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: draft.rounds.filter((_, itemIndex) => itemIndex !== index) })}>Remove question</Button> : null}
    </fieldset>)}
    <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: [...draft.rounds, { key: `round-${draft.rounds.length + 1}`, prompt: "", options: "", durationSeconds: "30" }] })}>Add question</Button>
  </div>;
}

function FamilyFeudFields({ draft, onChange }: { draft: FamilyFeudDraft; onChange: (draft: FamilyFeudDraft) => void }) {
  return <div className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Guests are assigned to a team by the server. Add host-accepted answer alternatives with their scores.</p>
    <fieldset className="grid gap-2 rounded-md border border-border p-3">
      <legend className="px-1 text-sm font-semibold">Teams</legend>
      {draft.teams.map((team, index) => <label key={team.id} className="grid gap-1 text-xs font-semibold">Team {index + 1}
        <input value={team.label} maxLength={80} onChange={(event) => onChange({ ...draft, teams: draft.teams.map((item) => item.id === team.id ? { ...item, label: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>)}
      {draft.teams.length < 8 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, teams: [...draft.teams, { id: globalThis.crypto.randomUUID(), label: `Team ${draft.teams.length + 1}` }] })}>Add team</Button> : null}
    </fieldset>
    {draft.rounds.map((round, index) => <fieldset key={round.key} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Question {index + 1}</legend>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Prompt
        <input value={round.prompt} maxLength={500} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Answer board: answer | accepted alternatives | points (one per line)
        <textarea rows={5} value={round.answers} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, answers: event.target.value } : item) })} className="rounded border border-border bg-background px-2 py-1 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Seconds per question
        <input type="number" min={5} max={600} value={round.durationSeconds} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      {draft.rounds.length > 1 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: draft.rounds.filter((_, itemIndex) => itemIndex !== index) })}>Remove question</Button> : null}
    </fieldset>)}
    <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: [...draft.rounds, { key: `round-${draft.rounds.length + 1}`, prompt: "", durationSeconds: "60", answers: "" }] })}>Add question</Button>
  </div>;
}

function SplitTheRoomFields({ draft, onChange }: { draft: SplitTheRoomDraft; onChange: (draft: SplitTheRoomDraft) => void }) {
  return <div className="mt-3 space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Guest text stays private pending host moderation. The host pauses a round to reveal the combined vote totals.</p>
    {draft.rounds.map((round, index) => <fieldset key={round.key} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold">Prompt {index + 1}</legend>
      <label className="grid gap-1 text-xs font-semibold sm:col-span-2">Prompt
        <input value={round.prompt} maxLength={500} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, prompt: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Left choice
        <input value={round.leftLabel} maxLength={80} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, leftLabel: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Right choice
        <input value={round.rightLabel} maxLength={80} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, rightLabel: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Maximum response length
        <input type="number" min={20} max={500} value={round.maxResponseLength} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, maxResponseLength: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      <label className="grid gap-1 text-xs font-semibold">Seconds for this round
        <input type="number" min={5} max={600} value={round.durationSeconds} onChange={(event) => onChange({ ...draft, rounds: draft.rounds.map((item, itemIndex) => itemIndex === index ? { ...item, durationSeconds: event.target.value } : item) })} className="min-h-9 rounded border border-border bg-background px-2 text-sm" />
      </label>
      {draft.rounds.length > 1 ? <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: draft.rounds.filter((_, itemIndex) => itemIndex !== index) })}>Remove prompt</Button> : null}
    </fieldset>)}
    <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...draft, rounds: [...draft.rounds, { key: `round-${draft.rounds.length + 1}`, prompt: "", leftLabel: "Left", rightLabel: "Right", maxResponseLength: "160", durationSeconds: "60" }] })}>Add prompt</Button>
  </div>;
}

export function hasPublishableTemplateConfiguration(game: PrismEventGameDefinition): boolean {
  const parsed = eventGameTemplateConfigurationSchema.safeParse(game.config?.configuration);
  return parsed.success && parsed.data.kind === game.kind;
}
