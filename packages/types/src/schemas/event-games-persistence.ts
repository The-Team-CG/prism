import { z } from "zod";
import { eventGameParticipantResultSchema } from "./event-games-inputs.js";

export const eventGameResponsePayloadSchema = z.record(
  z.string().trim().min(1).max(64),
  z.union([
    z.string().trim().min(1).max(500),
    z.number().finite(),
    z.boolean(),
    z.array(z.string().trim().min(1).max(120)).min(1).max(50),
  ]),
);

export const eventGameResponseScoreSchema = z.object({
  points: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  isCorrect: z.boolean(),
  result: eventGameParticipantResultSchema.optional(),
}).strict();

export const eventGameResponseCursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
}).strict();

export const advanceEventGameRoundCommandSchema = z.object({
  expectedRoundKey: z.string().regex(/^[A-Za-z0-9:_-]{1,120}$/),
  advanceByMs: z.number().int().min(1).max(600_000),
  expectedRoundOffsetMs: z.number().int().min(0),
  expectedStatus: z.enum(['live', 'paused']),
  expectedStartedAt: z.string().datetime({ offset: true }),
  expectedPausedAt: z.string().datetime({ offset: true }).nullable(),
  expectedTotalPausedMs: z.number().int().min(0),
}).strict();

export const eventGameFamilyFeudScoreResultSchema = z.object({
  points: z.number().int().nonnegative(),
  isCorrect: z.boolean(),
}).passthrough();

export const eventGameFamilyFeudAnswerPayloadSchema = z.object({ answer: z.string().trim().min(1).max(120) }).passthrough();

export type AdvanceEventGameRoundCommand = z.infer<typeof advanceEventGameRoundCommandSchema>;
