import { z } from "zod";

export const prismEventGameKindSchema = z.enum([
  "live-trivia",
  "bingo",
  "guess-picture",
  "spin-wheel",
  "this-or-that",
  "family-feud",
  "split-the-room",
  "word-scramble",
  "would-you-rather",
  "guess-picture-solo",
  "this-or-that-solo",
  "spot-the-difference",
]);
export type PrismEventGameKind = z.infer<typeof prismEventGameKindSchema>;

const eventGameMetadataShape = {
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  instructions: z.string().trim().max(2_000).optional(),
};

/** Base metadata only; mode configuration is added with its approved rule adapter. */
export const createEventGameSchema = z.object({
  kind: prismEventGameKindSchema,
  ...eventGameMetadataShape,
}).strict();
export type PrismCreateEventGameInput = z.infer<typeof createEventGameSchema>;

/** A template kind cannot be changed after the draft is created. */
export const updateEventGameSchema = z.object({
  title: eventGameMetadataShape.title.optional(),
  description: eventGameMetadataShape.description,
  instructions: eventGameMetadataShape.instructions,
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one game metadata field must be updated",
});
export type PrismUpdateEventGameInput = z.infer<typeof updateEventGameSchema>;

export const createGameSessionSchema = z.object({
  gameId: z.string().uuid(),
  scheduledStartAt: z.string().datetime({ offset: true }).optional(),
}).strict();
export type PrismCreateGameSessionInput = z.infer<typeof createGameSessionSchema>;

export const gameHostCommandSchema = z.object({
  command: z.enum([
    "start",
    "pause",
    "resume",
    "end",
    "cancel",
    "disable-joins",
    "enable-joins",
  ]),
  idempotencyKey: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
}).strict();
export type PrismGameHostCommandInput = z.infer<typeof gameHostCommandSchema>;

/** Body accepted only by the host-led Active (Multiplayer) PIN join route. */
export const joinActiveMultiplayerGameSessionSchema = z.object({
  idempotencyKey: z.string().uuid(),
  pin: z.string().regex(/^\d{6}$/),
}).strict();
export type PrismJoinActiveMultiplayerGameSessionInput = z.infer<typeof joinActiveMultiplayerGameSessionSchema>;

/** Independent (Singleplayer) games start from the event lobby and never accept a PIN. */
export const startIndependentSingleplayerGameSessionSchema = z.object({
  idempotencyKey: z.string().uuid(),
}).strict();
export type PrismStartIndependentSingleplayerGameInput = z.infer<typeof startIndependentSingleplayerGameSessionSchema>;
