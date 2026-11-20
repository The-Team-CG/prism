# Presenter Deck (Mentimeter-style) event game — design

Date: 2026-11-19
Status: approved by the requester's instruction to build (see "Decisions"); not yet reviewed by a second builder.

## Intent and why

PMCM runs live events and wants a Mentimeter-style audience tool: the presenter
steps through a deck of questions, the room answers on their phones, and the
host shows live results on each question. Existing event games already run
single-format audience rounds (Live Poll, Word Cloud, Open Q and A). A
multi-question deck lets one game mix formats the way Mentimeter does, without
the host creating three separate games.

## Goals

- One game template, `presenter-deck`, whose rounds are timed prompts of three
  types: multiple choice, rating scale, and word cloud.
- Results follow the existing audience pattern: hidden while a round is live,
  shown by the host when they pause (totals for choice and scale, approved words
  for word cloud).
- Works inside the existing active-session lifecycle (lobby, live, paused, joins,
  PIN) with no new session machinery.

## Non-goals

- Ranking questions, slides or images, quizzes with scoring, and a presenter
  view that mirrors a slide deck. Scoring is not part of this game.
- A new results store. Choice and scale reuse the existing round vote counts.
- Mentimeter branding, assets or copy. This is our own game with the same format.

## Anti-goals

- No second participant-facing storage key or browser-local fallback.
- No change to the other eleven audience and active templates' behavior.

## Constraints

- Shared contracts live in `@prism/types` as Zod schemas (AGENTS.md). The
  `event_game` kind column is a plain string, so no database migration.
- Guests stay anonymous to the room; votes are counted per round.
- Word-cloud answers go through PMCM moderation, as Word Cloud and Open Q and A do.

## Approaches (decided)

1. **One template with per-round types (chosen).** Adds one kind and round
   types. Matches the Mentimeter model. Choice and scale reuse vote aggregates
   by sending the option label; word cloud reuses moderation.
2. Three separate games, one per format. Already exists in part, but hosts must
   create several games for one talk. Rejected: this is the gap the request fills.
3. Generic deck builder with arbitrary round types and a slide editor. Rejected:
   much larger scope, and no existing pattern for slides in this system.

## Design

### Kind and rounds

- Kind: `presenter-deck`, label "Presenter Deck", entry mode `active`.
- Configuration: `{ kind: "presenter-deck", rounds: [...] }`, 1 to 30 rounds,
  unique round keys, each round `durationSeconds` 5 to 600.
- Round types (discriminated on `type`):
  - `choice`: `prompt`, `options` 2 to 6 distinct strings.
  - `scale`: `prompt`, `scaleMax` as 5 or 10. Guests pick an integer 1 to `scaleMax`.
  - `word-cloud`: `prompt`, `maxResponseLength` 10 to 60.

### Actions (guest submissions)

- `choice` and `scale`: `{ templateId: "presenter-deck", roundKey, actionKind: "vote", payload: { option } }`.
  For scale the option is the integer as a string ("1" to `scaleMax`). Storing the
  label as a string means the existing `getRoundVoteCounts` path counts it unchanged.
- `word-cloud`: `actionKind: "answer"`, `payload: { response }`, length-capped.
- The rule validates the payload against the active round's type.

### Results

- Aggregate visible only when paused, as for Live Poll. Options are the choice
  options, or `"1"` to `String(scaleMax)` for scale. Word-cloud rounds have no
  vote aggregate.
- `presenter-deck` joins the moderated response kinds, so approved word-cloud
  answers appear on pause like Word Cloud.
- Points: none. The rule returns `{ points: 0, isCorrect: false }`.

### Guest participant data

`PrismGameParticipantData` gains one `presenter-deck` variant per round type:
`{ kind: "presenter-deck", roundType: "choice", options }`,
`{ kind: "presenter-deck", roundType: "scale", scaleMax }`, and
`{ kind: "presenter-deck", roundType: "word-cloud", maxResponseLength }`.

### Host and guest UI

- Host: catalog entry, a configuration editor with a round-type selector per
  prompt, and pause/resume labels in the host view.
- Guest: the play view renders choice buttons, a 1..N button row for scale, or a
  word form for word cloud, using the existing controls and results pattern.

## Decisions made by the builder (not asked)

- Scale uses 1 to 5 or 1 to 10 only, to keep the button UI readable.
- Round type "word-cloud" is named like the existing kind but scoped to the deck.
- No changelog-specific migration; the kind string needs none.

## Left to the implementer

- Exact Tailwind classes and copy strings, within the existing audience-control style.
- Test file split, following the nearby `audience-response.rules.test.ts` pattern.

## Verification

- Types: schema tests for each round type and action variant.
- API: rule tests for validation, aggregate visibility, and moderation kind.
- Guest and host: component or repository tests for the new variant, plus typecheck.
- Build and full typecheck for touched workspaces; `check:boundaries` if imports move.
