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

export const prismEventGameBrandThemeSchema = z.enum(["prism", "ocean", "sunset", "forest"]);
export type PrismEventGameBrandTheme = z.infer<typeof prismEventGameBrandThemeSchema>;

function contrastRatioAgainstWhite(hex: string): number {
  if (!/^#[\da-f]{6}$/i.test(hex)) return 0;
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  return 1.05 / (luminance + 0.05);
}

const eventGameLobbyColorSchema = z.string().trim().regex(/^#[\da-f]{6}$/i, "Use a six-digit hex color")
  .refine((color) => contrastRatioAgainstWhite(color) >= 4.5, "Color must have at least 4.5:1 contrast against white");

const eventGameLobbyLogoObjectIdSchema = z.string().trim()
  .regex(/^obj_[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i, "Use a stored event-game logo object ID");

export const eventGameLobbyBrandingSettingsSchema = z.object({
  theme: prismEventGameBrandThemeSchema,
  primaryColor: eventGameLobbyColorSchema.optional(),
  secondaryColor: eventGameLobbyColorSchema.optional(),
  logoObjectId: eventGameLobbyLogoObjectIdSchema.nullable().optional(),
}).strict();

export const updateEventGameLobbyBrandingSchema = eventGameLobbyBrandingSettingsSchema.extend({
  idempotencyKey: z.string().uuid().refine((value) =>
    value[14] === "4" && ["8", "9", "a", "b"].includes(value[19]?.toLowerCase() ?? ""),
  "Expected UUIDv4 idempotency key"),
}).strict();
export type UpdateEventGameLobbyBrandingInput = z.infer<typeof updateEventGameLobbyBrandingSchema>;

export const requestEventGameLobbyLogoUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  declaredByteSize: z.number().int().positive().max(1_048_576),
  checksumSha256: z.string().trim().regex(/^[a-f\d]{64}$/i, "checksumSha256 must be a SHA-256 hex digest"),
  idempotencyKey: z.string().uuid().refine((value) =>
    value[14] === "4" && ["8", "9", "a", "b"].includes(value[19]?.toLowerCase() ?? ""),
  "Expected UUIDv4 idempotency key"),
}).strict();
export type RequestEventGameLobbyLogoUploadInput = z.infer<typeof requestEventGameLobbyLogoUploadSchema>;

export const requestEventGameMediaUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png"]),
  declaredByteSize: z.number().int().positive().max(8 * 1024 * 1024),
  checksumSha256: z.string().trim().regex(/^[a-f\d]{64}$/i, "checksumSha256 must be a SHA-256 hex digest"),
  idempotencyKey: z.string().uuid().refine((value) =>
    value[14] === "4" && ["8", "9", "a", "b"].includes(value[19]?.toLowerCase() ?? ""),
  "Expected UUIDv4 idempotency key"),
}).strict();
export type RequestEventGameMediaUploadInput = z.infer<typeof requestEventGameMediaUploadSchema>;

const gameActionKindSchema = z.enum([
  "answer",
  "mark",
  "vote",
  "guess",
  "spin",
  "select",
  "complete",
]);

const gameActionValueSchema = z.union([
  z.string().trim().min(1).max(500),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().trim().min(1).max(120)).min(1).max(50),
]);

const SERVER_OWNED_ACTION_KEYS = new Set([
  "actor",
  "actorid",
  "answerkey",
  "correct",
  "correctness",
  "createdat",
  "currentround",
  "deadline",
  "email",
  "bio",
  "eventid",
  "gameid",
  "avatar",
  "avatarurl",
  "firstname",
  "fullname",
  "handle",
  "image",
  "imageurl",
  "iscorrect",
  "moderator",
  "moderationstatus",
  "moderatorstatus",
  "participantcredential",
  "participantname",
  "name",
  "lastname",
  "displayname",
  "participantid",
  "photo",
  "photourl",
  "phone",
  "phonenumber",
  "profile",
  "profileurl",
  "picture",
  "username",
  "participanttoken",
  "points",
  "receivedat",
  "roundid",
  "roundkey",
  "roundnumber",
  "score",
  "sessionid",
  "submittedat",
  "team",
  "teamid",
  "timestamp",
  "userid",
  "winner",
  "winnerid",
]);

const gameActionPayloadSchema = z.record(
  z.string().trim().min(1).max(64),
  gameActionValueSchema,
).refine((payload) => {
  const entries = Object.entries(payload);
  return entries.length >= 1 && entries.length <= 20 &&
    entries.every(([key]) => !SERVER_OWNED_ACTION_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, "")));
}, {
  message: "Player action includes an empty payload or a server-owned field",
});

const genericGameActionSchema = z.object({
  roundKey: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/),
  actionKind: gameActionKindSchema,
  payload: gameActionPayloadSchema,
}).strict();

const activeMultiplayerRoundKeySchema = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/);
const bingoMarkedNumbersSchema = z.array(z.number().int().min(1).max(75)).min(1).max(25)
  .refine((numbers) => new Set(numbers).size === numbers.length, "Marked numbers must be unique");
/** Strict player-action variants for the implemented Active (Multiplayer) templates. */
export const activeMultiplayerGameActionSchema = z.discriminatedUnion("templateId", [
  z.object({
    templateId: z.literal("live-trivia"),
    roundKey: activeMultiplayerRoundKeySchema,
    actionKind: z.literal("answer"),
    payload: z.object({ answer: z.string().trim().min(1).max(120) }).strict(),
  }).strict(),
  z.object({
    templateId: z.literal("bingo"),
    roundKey: activeMultiplayerRoundKeySchema,
    actionKind: z.literal("mark"),
    payload: z.object({ claim: z.literal("bingo"), markedNumbers: bingoMarkedNumbersSchema }).strict(),
  }).strict(),
  z.object({
    templateId: z.literal("guess-picture"),
    roundKey: activeMultiplayerRoundKeySchema,
    actionKind: z.literal("guess"),
    payload: z.object({ answer: z.string().trim().min(1).max(120) }).strict(),
  }).strict(),
  z.object({
    templateId: z.literal("this-or-that"),
    roundKey: activeMultiplayerRoundKeySchema,
    actionKind: z.literal("vote"),
    payload: z.object({ option: z.string().trim().min(1).max(120) }).strict(),
  }).strict(),
  z.object({
    templateId: z.literal("family-feud"),
    roundKey: activeMultiplayerRoundKeySchema,
    actionKind: z.literal("answer"),
    payload: z.object({ answer: z.string().trim().min(1).max(120) }).strict(),
  }).strict(),
  z.object({
    templateId: z.literal("split-the-room"),
    roundKey: activeMultiplayerRoundKeySchema,
    actionKind: z.enum(["answer", "vote"]),
    payload: z.union([
      z.object({ response: z.string().trim().min(1).max(500) }).strict(),
      z.object({ option: z.string().trim().min(1).max(120) }).strict(),
    ]),
  }).strict().refine((action) =>
    (action.actionKind === "answer" && "response" in action.payload)
    || (action.actionKind === "vote" && "option" in action.payload),
  "Split the Room action kind must match its payload"),
]);

const independentSingleplayerGameActionSchema = z.discriminatedUnion("templateId", [
  z.object({
    templateId: z.literal("word-scramble"),
    roundKey: activeMultiplayerRoundKeySchema,
    actionKind: z.literal("answer"),
    payload: z.object({ answer: z.string().trim().min(1).max(120) }).strict(),
  }).strict(),
  z.object({
    templateId: z.literal("guess-picture-solo"),
    roundKey: activeMultiplayerRoundKeySchema,
    actionKind: z.literal("answer"),
    payload: z.object({ answer: z.string().trim().min(1).max(120) }).strict(),
  }).strict(),
  z.object({
    templateId: z.literal("spot-the-difference"),
    roundKey: activeMultiplayerRoundKeySchema,
    actionKind: z.literal("select"),
    payload: z.object({
      selections: z.array(z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
      }).strict()).min(1).max(12),
    }).strict(),
  }).strict(),
  z.object({
    templateId: z.literal("would-you-rather"),
    roundKey: activeMultiplayerRoundKeySchema,
    actionKind: z.enum(["complete", "vote"]),
    payload: z.object({ option: z.string().trim().min(1).max(120) }).strict(),
  }).strict(),
  z.object({
    templateId: z.literal("this-or-that-solo"),
    roundKey: activeMultiplayerRoundKeySchema,
    actionKind: z.enum(["complete", "vote"]),
    payload: z.object({ option: z.string().trim().min(1).max(120) }).strict(),
  }).strict(),
]);

/** Strict template writes precede the generic action envelope. */
export const submitEventGameActionSchema = z.union([
  activeMultiplayerGameActionSchema,
  independentSingleplayerGameActionSchema,
  genericGameActionSchema,
]);
export type PrismSubmitEventGameActionInput = z.infer<typeof submitEventGameActionSchema>;

const uuidV4Schema = z.string().uuid().refine((value) =>
  value[14] === "4" && ["8", "9", "a", "b"].includes(value[19]?.toLowerCase() ?? ""),
"Expected a UUIDv4 idempotency key");

export const moderateEventGameSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("resolve_family_feud_answer"),
    idempotencyKey: uuidV4Schema,
    submissionId: z.string().uuid(),
    /** Canonical configured board answer selected by the host; null records no award. */
    boardAnswer: z.string().trim().min(1).max(120).nullable(),
  }).strict(),
  z.object({
    action: z.literal("approve_submission"),
    idempotencyKey: uuidV4Schema,
    submissionId: z.string().uuid(),
    reason: z.string().trim().max(500).optional(),
  }).strict(),
  z.object({
    action: z.literal("hide_submission"),
    idempotencyKey: uuidV4Schema,
    submissionId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500),
  }).strict(),
  z.object({
    action: z.literal("remove_participant"),
    idempotencyKey: uuidV4Schema,
    participationGrantId: z.string().uuid(),
    reason: z.string().trim().min(1).max(500),
  }).strict(),
]);
export type PrismModerateEventGameInput = z.infer<typeof moderateEventGameSchema>;

const gameAwardRecipientSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("participant"), participationGrantId: z.string().uuid() }).strict(),
  z.object({ type: z.literal("team"), teamId: z.string().uuid() }).strict(),
]);

export const assignEventGameAwardSchema = z.object({
  idempotencyKey: uuidV4Schema,
  recipient: gameAwardRecipientSchema,
  awardKind: z.enum(["points", "badge", "prize"]),
  label: z.string().trim().min(1).max(120),
  points: z.number().int().min(0).max(100_000).optional(),
  prizeReference: z.string().trim().min(1).max(200).optional(),
}).strict().refine((value) =>
  (value.awardKind === "points") === (value.points !== undefined) &&
  (value.awardKind === "prize") === (value.prizeReference !== undefined), {
  message: "Points and prize references must match the selected award kind",
});
export type PrismAssignEventGameAwardInput = z.infer<typeof assignEventGameAwardSchema>;

export const eventGameResponseHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().min(1).max(512).optional(),
}).strict();
export type PrismEventGameResponseHistoryQuery = z.infer<typeof eventGameResponseHistoryQuerySchema>;

const eventGameMetadataShape = {
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  instructions: z.string().trim().max(2_000).optional(),
  availableFrom: z.string().datetime({ offset: true }).optional(),
  availableUntil: z.string().datetime({ offset: true }).optional(),
};

function hasOrderedAvailabilityWindow(availableFrom?: string, availableUntil?: string): boolean {
  return !availableFrom || !availableUntil || Date.parse(availableUntil) > Date.parse(availableFrom);
}

export const eventGameMediaObjectIdSchema = z.string().regex(
  /^obj_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  "Expected a stored game media object ID",
);
export const eventGameMediaObjectIdsSchema = z.array(eventGameMediaObjectIdSchema)
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length, "Game media references must be unique");

const boundedPointsSchema = z.number().int().min(0).max(100_000);
const bingoNumberSchema = z.number().int().min(1).max(75);

export const eventGameParticipantResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("spin-wheel"),
    outcomeId: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9:_-]+$/),
    label: z.string().trim().min(1).max(120),
    points: boundedPointsSchema,
  }).strict(),
  z.object({
    kind: z.literal("singleplayer-choice"),
    option: z.string().trim().min(1).max(120),
  }).strict(),
]);

const liveTriviaConfigurationSchema = z.object({
  kind: z.literal("live-trivia"),
  rounds: z.array(z.object({
    key: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/),
    prompt: z.string().trim().min(1).max(500),
    options: z.array(z.string().trim().min(1).max(120)).min(2).max(6),
    correctAnswer: z.string().trim().min(1).max(120),
    points: boundedPointsSchema,
    durationSeconds: z.number().int().min(5).max(600),
    speedBonusPoints: boundedPointsSchema.optional(),
  }).strict()).min(1).max(30)
    .refine((rounds) => new Set(rounds.map(({ key }) => key)).size === rounds.length, "Round keys must be unique")
    .refine((rounds) => rounds.every(({ options, correctAnswer }) =>
      options.includes(correctAnswer) && new Set(options.map((option) => option.toLocaleLowerCase())).size === options.length,
    ), "Answers must match one unique configured option"),
}).strict();

const bingoConfigurationSchema = z.object({
  kind: z.literal("bingo"),
  callSequence: z.array(bingoNumberSchema).min(24).max(75)
    .refine((numbers) => new Set(numbers).size === numbers.length, "Called numbers must be unique"),
  callIntervalSeconds: z.number().int().min(5).max(120),
  winPattern: z.enum(["line", "full-card"]),
  points: boundedPointsSchema,
}).strict();

const guessPictureConfigurationSchema = z.object({
  kind: z.literal("guess-picture"),
  mediaObjectId: eventGameMediaObjectIdSchema,
  acceptedAnswers: z.array(z.string().trim().min(1).max(120)).min(1).max(20)
    .refine((answers) => new Set(answers.map((answer) => answer.toLocaleLowerCase())).size === answers.length, "Accepted answers must be unique"),
  stages: z.array(z.object({
    afterSeconds: z.number().int().min(0).max(3600),
    hint: z.string().trim().min(1).max(300),
    points: boundedPointsSchema,
  }).strict()).min(1).max(10)
    .refine((stages) => stages[0]?.afterSeconds === 0, "The first image stage must start at zero seconds")
    .refine((stages) => stages.every((stage, index) => index === 0 || stage.afterSeconds > stages[index - 1]!.afterSeconds), "Reveal stages must be ordered"),
}).strict();

const spinWheelConfigurationSchema = z.object({
  kind: z.literal("spin-wheel"),
  outcomes: z.array(z.object({
    id: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9:_-]+$/),
    label: z.string().trim().min(1).max(120),
    weight: z.number().int().min(1).max(100_000),
    points: boundedPointsSchema,
    eligible: z.boolean(),
  }).strict()).min(2).max(50)
    .refine((outcomes) => new Set(outcomes.map(({ id }) => id)).size === outcomes.length, "Outcome IDs must be unique")
    .refine((outcomes) => outcomes.some(({ eligible }) => eligible), "At least one wheel outcome must be eligible"),
}).strict();

const thisOrThatConfigurationSchema = z.object({
  kind: z.literal("this-or-that"),
  rounds: z.array(z.object({
    key: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/),
    prompt: z.string().trim().min(1).max(500),
    options: z.array(z.string().trim().min(1).max(120)).length(2)
      .refine((options) => new Set(options.map((option) => option.toLocaleLowerCase())).size === options.length,
        "This or That options must be different"),
    durationSeconds: z.number().int().min(5).max(600),
  }).strict()).min(1).max(30)
    .refine((rounds) => new Set(rounds.map(({ key }) => key)).size === rounds.length, "Round keys must be unique"),
}).strict();

const familyFeudConfigurationSchema = z.object({
  kind: z.literal("family-feud"),
  teams: z.array(z.object({
    id: uuidV4Schema,
    label: z.string().trim().min(1).max(80),
  }).strict()).min(2).max(8)
    .refine((teams) => new Set(teams.map(({ id }) => id)).size === teams.length, "Team IDs must be unique")
    .refine((teams) => new Set(teams.map(({ label }) => label.toLocaleLowerCase())).size === teams.length,
      "Team labels must be unique"),
  rounds: z.array(z.object({
    key: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/),
    prompt: z.string().trim().min(1).max(500),
    durationSeconds: z.number().int().min(5).max(600),
    answers: z.array(z.object({
      answer: z.string().trim().min(1).max(120),
      alternatives: z.array(z.string().trim().min(1).max(120)).max(8),
      points: boundedPointsSchema,
    }).strict()).min(1).max(20)
      .refine((answers) => new Set(answers.map(({ answer }) => answer.toLocaleLowerCase())).size === answers.length,
        "Family Feud answers must be unique"),
  }).strict()).min(1).max(20)
    .refine((rounds) => new Set(rounds.map(({ key }) => key)).size === rounds.length, "Round keys must be unique"),
}).strict();

const splitTheRoomConfigurationSchema = z.object({
  kind: z.literal("split-the-room"),
  rounds: z.array(z.object({
    key: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/),
    prompt: z.string().trim().min(1).max(500),
    leftLabel: z.string().trim().min(1).max(80),
    rightLabel: z.string().trim().min(1).max(80),
    maxResponseLength: z.number().int().min(20).max(500),
    durationSeconds: z.number().int().min(5).max(600),
  }).strict()).min(1).max(20)
    .refine((rounds) => new Set(rounds.map(({ key }) => key)).size === rounds.length, "Round keys must be unique"),
}).strict();

const wordScrambleConfigurationSchema = z.object({
  kind: z.literal("word-scramble"),
  rounds: z.array(z.object({
    key: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/),
    scrambledWord: z.string().trim().min(1).max(120),
    answer: z.string().trim().min(1).max(120),
    points: boundedPointsSchema,
    durationSeconds: z.number().int().min(5).max(600),
  }).strict()).min(1).max(30)
    .refine((rounds) => new Set(rounds.map(({ key }) => key)).size === rounds.length, "Round keys must be unique"),
}).strict();

const guessPictureSoloConfigurationSchema = z.object({
  kind: z.literal("guess-picture-solo"),
  rounds: z.array(z.object({
    key: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/),
    mediaObjectId: eventGameMediaObjectIdSchema,
    acceptedAnswers: z.array(z.string().trim().min(1).max(120)).min(1).max(20)
      .refine((answers) => new Set(answers.map((answer) => answer.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase())).size === answers.length,
        "Accepted answers must be unique"),
    stages: z.array(z.object({
      afterSeconds: z.number().int().min(0).max(3600),
      hint: z.string().trim().min(1).max(300),
      points: boundedPointsSchema,
    }).strict()).min(1).max(10)
      .refine((stages) => stages[0]?.afterSeconds === 0, "The first image stage must start at zero seconds")
      .refine(
        (stages) => stages.every((stage, index) => index === 0 || stage.afterSeconds > stages[index - 1]!.afterSeconds),
        "Reveal stages must be ordered",
      ),
    durationSeconds: z.number().int().min(5).max(600),
  }).strict().refine((round) => round.stages.every(({ afterSeconds }) => afterSeconds < round.durationSeconds),
    "Reveal stages must start before the round ends")).min(1).max(20)
    .refine((rounds) => new Set(rounds.map(({ key }) => key)).size === rounds.length, "Round keys must be unique"),
}).strict();

const differenceRegionSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.01).max(0.5),
  height: z.number().min(0.01).max(0.5),
  points: boundedPointsSchema,
}).strict().refine(({ x, y, width, height }) => x + width <= 1 && y + height <= 1,
  "Difference regions must fit inside the comparison image");

const spotTheDifferenceConfigurationSchema = z.object({
  kind: z.literal("spot-the-difference"),
  rounds: z.array(z.object({
    key: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/),
    originalMediaObjectId: eventGameMediaObjectIdSchema,
    comparisonMediaObjectId: eventGameMediaObjectIdSchema,
    differences: z.array(differenceRegionSchema).min(1).max(12),
    durationSeconds: z.number().int().min(5).max(600),
  }).strict().refine((round) => round.originalMediaObjectId !== round.comparisonMediaObjectId,
    "Spot the Difference requires two distinct images")).min(1).max(20)
    .refine((rounds) => new Set(rounds.map(({ key }) => key)).size === rounds.length, "Round keys must be unique"),
}).strict();

const independentChoiceOptionsSchema = z.array(z.string().trim().min(1).max(120)).length(2)
  .refine((options) => new Set(options.map((option) => option.toLocaleLowerCase())).size === options.length,
    "Choice options must be different");

const wouldYouRatherConfigurationSchema = z.object({
  kind: z.literal("would-you-rather"),
  rounds: z.array(z.object({
    key: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/),
    prompt: z.string().trim().min(1).max(500),
    options: independentChoiceOptionsSchema,
    durationSeconds: z.number().int().min(5).max(600),
    aggregateResults: z.boolean(),
  }).strict()).min(1).max(30)
    .refine((rounds) => new Set(rounds.map(({ key }) => key)).size === rounds.length, "Round keys must be unique"),
}).strict();

const thisOrThatSoloConfigurationSchema = z.object({
  kind: z.literal("this-or-that-solo"),
  rounds: z.array(z.object({
    key: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/),
    prompt: z.string().trim().min(1).max(500),
    options: independentChoiceOptionsSchema,
    durationSeconds: z.number().int().min(5).max(600),
  }).strict()).min(1).max(30)
    .refine((rounds) => new Set(rounds.map(({ key }) => key)).size === rounds.length, "Round keys must be unique"),
}).strict();

/** Strict, mode-tagged configs for implemented Active (Multiplayer) and Independent (Singleplayer) templates. */
export const eventGameTemplateConfigurationSchema = z.discriminatedUnion("kind", [
  liveTriviaConfigurationSchema,
  bingoConfigurationSchema,
  guessPictureConfigurationSchema,
  spinWheelConfigurationSchema,
  thisOrThatConfigurationSchema,
  familyFeudConfigurationSchema,
  splitTheRoomConfigurationSchema,
  wordScrambleConfigurationSchema,
  guessPictureSoloConfigurationSchema,
  spotTheDifferenceConfigurationSchema,
  wouldYouRatherConfigurationSchema,
  thisOrThatSoloConfigurationSchema,
]);
export type PrismEventGameTemplateConfiguration = z.infer<typeof eventGameTemplateConfigurationSchema>;

/** Draft metadata and an optional, strictly typed template configuration. */
export const createEventGameSchema = z.object({
  kind: prismEventGameKindSchema,
  ...eventGameMetadataShape,
  configuration: eventGameTemplateConfigurationSchema.optional(),
}).strict().refine((value) => !value.configuration || value.configuration.kind === value.kind, {
  message: "Game configuration must match the selected template",
  path: ["configuration"],
}).refine((value) => hasOrderedAvailabilityWindow(value.availableFrom, value.availableUntil), {
  message: "Game availability end must be after its start",
  path: ["availableUntil"],
});
export type PrismCreateEventGameInput = z.infer<typeof createEventGameSchema>;

/** A template kind cannot be changed after the draft is created. */
export const updateEventGameSchema = z.object({
  title: eventGameMetadataShape.title.optional(),
  description: eventGameMetadataShape.description,
  instructions: eventGameMetadataShape.instructions,
  availableFrom: eventGameMetadataShape.availableFrom,
  availableUntil: eventGameMetadataShape.availableUntil,
  mediaObjectIds: eventGameMediaObjectIdsSchema.optional(),
  configuration: eventGameTemplateConfigurationSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one game metadata field must be updated",
}).refine((value) => hasOrderedAvailabilityWindow(value.availableFrom, value.availableUntil), {
  message: "Game availability end must be after its start",
  path: ["availableUntil"],
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
    "spin-wheel",
    "advance-round",
    "end",
    "cancel",
    "disable-joins",
    "enable-joins",
  ]),
  idempotencyKey: z.string().uuid(),
  roundKey: activeMultiplayerRoundKeySchema.optional(),
  reason: z.string().trim().max(500).optional(),
}).strict().refine((value) =>
  (value.command === "advance-round") === (value.roundKey !== undefined),
"A current round key is required only for the next-round command");
export type PrismGameHostCommandInput = z.infer<typeof gameHostCommandSchema>;

/** Body accepted only by the host-led Active (Multiplayer) PIN join route. */
export const joinActiveMultiplayerGameSessionSchema = z.object({
  expectedEventId: z.string().trim().min(1).max(120).optional(),
  idempotencyKey: z.string().uuid().refine((value) =>
    value[14] === "4" && ["8", "9", "a", "b"].includes(value[19]?.toLowerCase() ?? ""),
  "Join idempotency keys must be UUIDv4 values"),
  // Keep malformed codes inside the same generic guest-safe failure path.
  pin: z.string().max(64),
}).strict();
export type PrismJoinActiveMultiplayerGameSessionInput = z.infer<typeof joinActiveMultiplayerGameSessionSchema>;

export const joinedMultiplayerGameSessionSchema = z.object({
  eventId: z.string().trim().min(1).max(120),
  sessionId: z.string().trim().min(1).max(120),
  game: z.object({
    title: z.string().trim().min(1).max(120),
    kind: prismEventGameKindSchema,
  }).strict(),
  status: z.enum(["lobby", "live"]),
  participantCredential: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
}).strict();

/** Independent (Singleplayer) games start from the event lobby and never accept a PIN. */
export const startIndependentSingleplayerGameSessionSchema = z.object({
  idempotencyKey: z.string().uuid().refine((value) =>
    value[14] === "4" && ["8", "9", "a", "b"].includes(value[19]?.toLowerCase() ?? ""),
  "Start idempotency keys must be UUIDv4 values"),
  /** Existing server-issued event participant credential; never accepted if unknown or revoked. */
  participantCredential: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
}).strict();
export type PrismStartIndependentSingleplayerGameInput = z.infer<typeof startIndependentSingleplayerGameSessionSchema>;
