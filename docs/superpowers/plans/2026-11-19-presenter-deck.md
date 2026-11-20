# Presenter Deck Implementation Plan

> **For agentic workers:** Execution is subagent-driven: Opus (high) runs Tasks 1-2, then Haiku (high) runs Tasks 3-4 in parallel. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Mentimeter-style `presenter-deck` event game: a timed deck of choice, rating-scale and word-cloud prompts, with results shown by the host on pause.

**Architecture:** One new kind in the shared Zod contract (`@prism/types`), one rule module in the event-games API context that reuses the audience patterns (vote counts keyed by option label, moderated word-cloud answers), and UI branches in the guest and event apps. No database migration: the kind column is a string.

**Tech Stack:** TypeScript, Zod (`@prism/types`), NestJS event-games module (Vitest), Next.js guest and event portals.

**Spec:** [docs/superpowers/specs/2026-11-19-presenter-deck-design.md](../specs/2026-11-19-presenter-deck-design.md)

## Global Constraints

- Shared contracts: Zod schema + `z.infer` in `packages/types/src/schemas/event-games-inputs.ts` only; no app-local copies.
- No new storage keys, no browser-local fallback, no DB migration.
- No cross-app imports. Guest and event changes stay in `apps/guest` and `apps/event`.
- Do not commit. Leave changes in the working tree on `feat/presenter-deck-game`.
- Word-cloud answers go through moderation (`MODERATED_RESPONSE_KINDS`).
- Scale is an integer 1 to `scaleMax`, where `scaleMax` is exactly 5 or 10.
- Choice has 2 to 6 distinct options. Word cloud `maxResponseLength` is 10 to 60. Round `durationSeconds` is 5 to 600. Rounds are 1 to 30 with unique keys.

## Review Focus

1. Scale vote submitted as `"0"`, `"11"` or `"3.5"` must be rejected by the rule, not counted.
2. Choice vote for an option not in the round's list must be rejected.
3. Word-cloud answer longer than the round's `maxResponseLength` must be rejected.
4. Vote totals must stay hidden while the round is live and appear only when paused.
5. A word-cloud round must not expose a choice/scale vote aggregate (no empty buckets leaked).

Each line is pinned by a test in Task 2 (rule) or Task 1 (schema).

---

### Task 1: Shared contract (Opus)

**Files:**
- Modify: `packages/types/src/schemas/event-games-inputs.ts`
- Modify: `packages/types/src/event-games.ts` (participant data union near line 286)
- Test: `packages/types/src/schemas/event-games-inputs.test.ts`

**Interfaces:**
- Produces: `"presenter-deck"` in `prismEventGameKindSchema`; `presenterDeckConfigurationSchema` (exported as part of `eventGameTemplateConfigurationSchema`); a `presenter-deck` branch in `activeMultiplayerGameActionSchema`; `PrismGameParticipantData` variants:
  `{ kind: "presenter-deck"; roundType: "choice"; options: readonly string[] }`,
  `{ kind: "presenter-deck"; roundType: "scale"; scaleMax: number }`,
  `{ kind: "presenter-deck"; roundType: "word-cloud"; maxResponseLength: number }`.
- Round config shape (discriminated on `type`): `{ key, type: "choice", prompt, options, durationSeconds }`, `{ key, type: "scale", prompt, scaleMax: 5 | 10, durationSeconds }`, `{ key, type: "word-cloud", prompt, maxResponseLength, durationSeconds }`. All `.strict()`.
- Action: `{ templateId: "presenter-deck", roundKey, actionKind: "vote", payload: { option } }` or `{ ..., actionKind: "answer", payload: { response } }`, with a refine that the action kind matches the payload.

- [ ] **Step 1: Write the failing schema tests**

Add cases to `event-games-inputs.test.ts` (in the existing table-driven block): accepts a valid deck with one round of each type; rejects `scaleMax: 7`; rejects a choice round with 1 option; rejects duplicate round keys; accepts a `presenter-deck` vote with `{ option: "3" }` and rejects `{ option: "0" }` at the schema level only where the schema can know it (it cannot: leave scale range to the rule); rejects `actionKind: "answer"` with an `option` payload.

- [ ] **Step 2: Run them to see them fail**

Run: `npm --workspace @prism/types run test -- event-games-inputs`
Expected: FAIL, because `presenter-deck` is not in the enum.

- [ ] **Step 3: Implement the schema, the action branch, and the participant data variants**

Add the kind to `prismEventGameKindSchema`. Add `presenterDeckConfigurationSchema` with a `z.discriminatedUnion("type", [...])` of the three round shapes, reusing `audienceRoundKeySchema` and `uniqueRoundKeys`. Add the `presenter-deck` action branch with a refine. Extend the participant data union in `event-games.ts`.

- [ ] **Step 4: Run tests to verify they pass, then build the types package**

Run: `npm --workspace @prism/types run test && npm --workspace @prism/types run typecheck && npm --workspace @prism/types run build`
Expected: all PASS, build writes `dist/`. Guest and event depend on this build.

---

### Task 2: API rule, aggregates and moderation (Opus)

**Files:**
- Create: `apps/api/src/modules/event-games/application/rules/presenter-deck.rules.ts`
- Create: `apps/api/src/modules/event-games/application/rules/presenter-deck.rules.test.ts`
- Modify: `apps/api/src/modules/event-games/application/default-game-rules.ts` (register `presenterDeckRule`)
- Modify: `apps/api/src/modules/event-games/application/game-vote-aggregates.ts`
- Modify: `apps/api/src/modules/event-games/application/game-read-model.service.ts:37` (add `'presenter-deck'` to `MODERATED_RESPONSE_KINDS`)

**Interfaces:**
- Consumes: Task 1 schema and types; `templateConfiguration` from `./template-configuration`.
- Produces: `export const presenterDeckRule: GameRuleDefinition` (`templateId: "presenter-deck"`).

- [ ] **Step 1: Write the failing rule tests**

Tests in `presenter-deck.rules.test.ts`, following `audience-response.rules.test.ts`:
- `getCurrentRound` returns the choice round's `participantData` with `roundType: "choice"` and its options.
- Scale round returns `{ roundType: "scale", scaleMax }`; word-cloud returns `{ roundType: "word-cloud", maxResponseLength }`.
- Choice vote `"Tea"` on option list `["Tea","Coffee"]` → `[]`; vote `"Milk"` → an error (Review Focus 2).
- Scale vote `"3"` with `scaleMax: 5` → `[]`; `"0"`, `"6"`, `"3.5"` → an error (Review Focus 1).
- Word-cloud answer of length `maxResponseLength + 1` → an error (Review Focus 3).
- `scoreSubmission` returns `{ points: 0, isCorrect: false }`.

- [ ] **Step 2: Run them to see them fail**

Run: `npm --workspace apps/api test -- presenter-deck`
Expected: FAIL, because the module does not exist.

- [ ] **Step 3: Implement the rule, register it, and extend aggregates and moderation**

`presenterDeckRule` follows the shape of `audienceRule` in `audience-response.rules.ts`: `getCurrentRound` finds the active round by elapsed time, `validateSubmission` checks the payload against the round's `type`, `scoreSubmission` returns zero points. Register it in `default-game-rules.ts`.

In `game-vote-aggregates.ts`: treat `presenter-deck` as visible when the session is paused (Review Focus 4), and return its options for the active round. Choice rounds return their options; scale rounds return `["1", ..., String(scaleMax)]`; word-cloud rounds return `null` (Review Focus 5). Add `'presenter-deck'` to `MODERATED_RESPONSE_KINDS`.

- [ ] **Step 4: Run focused tests and the event-games suite**

Run: `npm --workspace apps/api test -- event-games` and `npm --workspace apps/api run typecheck`
Expected: PASS. Also run `npm --workspace apps/api run check:boundaries` if available.

---

### Task 3: Guest play UI (Haiku)

**Files:**
- Modify: `apps/guest/src/features/event-games/data/event-games-guest-repository.ts` (`sanitizeAudienceGameData`, near line 210)
- Modify: `apps/guest/src/features/event-games/model/event-game-entry-rules.ts` (add `"presenter-deck"` to `ACTIVE_MULTIPLAYER_GAME_KINDS`)
- Modify: `apps/guest/src/features/event-games/play/view-models/use-event-game-play-view-model.ts` (add to the active kinds list near line 111)
- Modify: `apps/guest/src/features/event-games/play/views/audience-game-controls.tsx`
- Test: `apps/guest/src/features/event-games/data/event-games-guest-repository.test.ts`

**Interfaces:**
- Consumes: Task 1 `PrismGameParticipantData` variants and the `"presenter-deck"` action shape; Task 2 is not required to build.

- [ ] **Step 1: Write the failing repository test**

Add a case to `event-games-guest-repository.test.ts`: a `presenter-deck` choice participant payload sanitizes to `{ kind: "presenter-deck", roundType: "choice", options }`; a scale payload with `scaleMax: 10` passes through; an out-of-range `scaleMax: 7` returns `undefined`.

- [ ] **Step 2: Run it to see it fail**

Run: `npm --workspace apps/guest test -- event-games-guest-repository`
Expected: FAIL.

- [ ] **Step 3: Implement sanitization, kind registration, and the controls**

In `audience-game-controls.tsx`, dispatch `data.kind === "presenter-deck"` by `roundType`:
- choice: reuse the `LivePollControls` pattern with `templateId: "presenter-deck"`, `actionKind: "vote"`, `payload: { option }`.
- scale: a row of buttons labelled 1 to `scaleMax`, sending `payload: { option: String(n) }`.
- word-cloud: reuse `AudienceTextControls` with `templateId: "presenter-deck"` and `actionKind: "answer"`.
Pass the round type through; the controls must not render when `state.game.kind !== "presenter-deck"`.

- [ ] **Step 4: Run the guest tests and typecheck**

Run: `npm --workspace apps/guest test -- event-games` and `npm --workspace apps/guest run typecheck`
Expected: PASS.

---

### Task 4: Host catalog, configuration editor and host labels (Haiku)

**Files:**
- Modify: `apps/event/src/features/event-games/host/model/event-game-catalog.ts` (add `{ kind: "presenter-deck", label: "Presenter Deck", entryMode: "active" }`)
- Modify: `apps/event/src/features/event-games/host/view-models/use-event-games-host-view-model.ts` (add to the refreshable kinds list near line 436)
- Modify: `apps/event/src/features/event-games/host/views/event-games-host-view.tsx` (pause and resume labels, near lines 640-660)
- Modify: `apps/event/src/features/event-games/host/views/event-game-template-configuration-editor.tsx` (add to `CONFIGURABLE_TEMPLATES` and `EXTENDED_TEMPLATE_KINDS`)
- Modify: `apps/event/src/features/event-games/host/views/audience-game-configuration.tsx` or a sibling `presenter-deck-configuration.tsx` for the editor fields
- Test: `apps/event/src/features/event-games/host/views/event-game-template-configuration-editor.test.tsx`

**Interfaces:**
- Consumes: Task 1 `presenterDeckConfigurationSchema` output shape (round `type`, `options`, `scaleMax`, `maxResponseLength`, `durationSeconds`).

- [ ] **Step 1: Write the failing editor test**

Add a case: building a presenter-deck configuration from a draft with one choice round (2 options), one scale round (`scaleMax` 5), and one word-cloud round (`maxResponseLength` 30) returns the exact configuration object shape from Task 1.

- [ ] **Step 2: Run it to see it fail**

Run: `npm --workspace apps/event test -- event-game-template-configuration-editor`
Expected: FAIL.

- [ ] **Step 3: Implement the catalog entry, labels, and editor**

Add the catalog entry. Labels: pause `"Reveal results and pause"`, resume `"Resume timed prompts"`. The editor lets the host add/remove prompts, pick each prompt's type (choice, scale, word cloud), and fill that type's fields: options one per line for choice, a 5/10 selector for scale, a max length for word cloud, and seconds open for all.

- [ ] **Step 4: Run the event tests and typecheck**

Run: `npm --workspace apps/event test -- event-games` and `npm --workspace apps/event run typecheck`
Expected: PASS.

---

### Task 5: Changelog and verification (me)

- [ ] **Step 1: Add a `CHANGELOG.md` entry** describing the Presenter Deck game for hosts and guests, one concise line.
- [ ] **Step 2: Run the full touched-workspace checks**: `npm --workspace @prism/types run typecheck`, `npm --workspace apps/api run validate` (or typecheck and build), guest and event typecheck and focused tests, `npm run check:boundaries`.
- [ ] **Step 3: Report results.** Show command output for anything that fails, and say what was not run.
