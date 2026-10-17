import {
  PRISM_EVENT_GAME_BRAND_THEMES,
  requestEventGameMediaUploadSchema,
  requestEventGameLobbyLogoUploadSchema,
  assignEventGameAwardSchema,
  updateEventGameLobbyBrandingSchema,
  type PrismAssignEventGameAwardInput,
  type PrismEventGameHostLobbyBranding,
  type PrismCreateEventGameInput,
  type PrismCreateGameSessionInput,
  type PrismGameHostCommandInput,
  type PrismModerateEventGameInput,
  type PrismUpdateEventGameInput,
  type UpdateEventGameLobbyBrandingInput,
} from "@prism/types";
import { eventGamesHostRepository } from "../data/event-games-host-repository";

function idempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export const eventGamesHostActions = {
  async loadWorkspace(eventId: string) {
    const [games, analytics, branding] = await Promise.all([
      eventGamesHostRepository.listForEvent(eventId),
      eventGamesHostRepository.getAnalytics(eventId),
      eventGamesHostRepository.getLobbyBranding(eventId),
    ]);
    return { games, analytics, branding };
  },

  createDraft(eventId: string, input: PrismCreateEventGameInput) {
    return eventGamesHostRepository.createDraft(eventId, input);
  },

  updateDraft(eventId: string, gameId: string, input: PrismUpdateEventGameInput) {
    return eventGamesHostRepository.updateDraft(eventId, gameId, input);
  },

  archiveGame(eventId: string, gameId: string) {
    return eventGamesHostRepository.archiveGame(eventId, gameId);
  },

  publishDraft(eventId: string, gameId: string) {
    return eventGamesHostRepository.publishDraft(eventId, gameId);
  },

  createHostSession(eventId: string, gameId: string, scheduledStartAt?: string) {
    const input: PrismCreateGameSessionInput = {
      gameId,
      ...(scheduledStartAt ? { scheduledStartAt } : {}),
    };
    return eventGamesHostRepository.createHostSession(eventId, gameId, input);
  },

  executeHostCommand(eventId: string, sessionId: string, command: PrismGameHostCommandInput["command"], roundKey?: string) {
    const input: PrismGameHostCommandInput = { command, idempotencyKey: idempotencyKey(), ...(roundKey ? { roundKey } : {}) };
    return eventGamesHostRepository.executeHostCommand(eventId, sessionId, input);
  },

  getHostState(eventId: string, sessionId: string) {
    return eventGamesHostRepository.getHostState(eventId, sessionId);
  },

  ensureLobby(eventId: string) {
    return eventGamesHostRepository.ensureLobby(eventId);
  },

  updateLobbyBranding(
    eventId: string,
    settings: Omit<UpdateEventGameLobbyBrandingInput, "idempotencyKey">,
  ): Promise<PrismEventGameHostLobbyBranding> {
    const parsed = updateEventGameLobbyBrandingSchema.safeParse({ ...settings, idempotencyKey: idempotencyKey() });
    if (!parsed.success) throw new Error("Choose a theme and accessible colors, then try again.");
    return eventGamesHostRepository.updateLobbyBranding(eventId, parsed.data);
  },

  async uploadLobbyLogo(
    eventId: string,
    file: File,
    current: PrismEventGameHostLobbyBranding | null,
  ): Promise<PrismEventGameHostLobbyBranding> {
    const checksumSha256 = await sha256(file);
    const request = requestEventGameLobbyLogoUploadSchema.safeParse({
      fileName: file.name,
      contentType: file.type,
      declaredByteSize: file.size,
      checksumSha256,
      idempotencyKey: idempotencyKey(),
    });
    if (!request.success) {
      throw new Error("Choose a PNG, JPEG, or WebP logo that is no larger than 1 MB.");
    }

    const ticket = await eventGamesHostRepository.requestLobbyLogoUpload(eventId, request.data);
    if (!ticket.alreadyStored) {
      if (!ticket.uploadUrl) throw new Error("The logo upload could not be started. Try again.");
      const upload = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!upload.ok) throw new Error("The logo could not be uploaded. Try again.");
      await eventGamesHostRepository.confirmLobbyLogoUpload(eventId, ticket.objectId, {
        checksumSha256,
        byteSize: file.size,
      });
    }

    const palette = PRISM_EVENT_GAME_BRAND_THEMES[current?.theme ?? "prism"];
    const branding = updateEventGameLobbyBrandingSchema.safeParse({
      theme: current?.theme ?? "prism",
      primaryColor: current?.primaryColor ?? palette.primaryColor,
      secondaryColor: current?.secondaryColor ?? palette.secondaryColor,
      logoObjectId: ticket.objectId,
      idempotencyKey: idempotencyKey(),
    });
    if (!branding.success) throw new Error("The lobby branding settings could not be saved. Try again.");
    return eventGamesHostRepository.updateLobbyBranding(eventId, branding.data);
  },

  async uploadGameMedia(eventId: string, gameId: string, file: File): Promise<{ objectId: string }> {
    const checksumSha256 = await sha256(file);
    const request = requestEventGameMediaUploadSchema.safeParse({
      fileName: file.name,
      contentType: file.type,
      declaredByteSize: file.size,
      checksumSha256,
      idempotencyKey: idempotencyKey(),
    });
    if (!request.success) throw new Error("Choose a PNG or JPEG game image that is no larger than 8 MB.");

    const ticket = await eventGamesHostRepository.requestGameMediaUpload(eventId, gameId, request.data);
    if (!ticket.alreadyStored) {
      if (!ticket.uploadUrl) throw new Error("The game image upload could not be started. Try again.");
      const upload = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!upload.ok) throw new Error("The game image could not be uploaded. Try again.");
      await eventGamesHostRepository.confirmGameMediaUpload(eventId, gameId, ticket.objectId, {
        checksumSha256,
        byteSize: file.size,
      });
    }
    return { objectId: ticket.objectId };
  },

  getResponseHistory(eventId: string, sessionId: string, cursor?: string) {
    return eventGamesHostRepository.getResponseHistory(eventId, sessionId, {
      limit: 25,
      ...(cursor ? { cursor } : {}),
    });
  },

  moderate(
    eventId: string,
    sessionId: string,
    submissionId: string,
    action: "approve_submission" | "hide_submission",
    reason?: string,
  ) {
    const base = {
      action,
      idempotencyKey: idempotencyKey(),
      submissionId,
    } as const;
    const input: PrismModerateEventGameInput = action === "hide_submission"
      ? { ...base, action, reason: reason?.trim() ?? "" }
      : { ...base, action };
    return eventGamesHostRepository.moderate(eventId, sessionId, input);
  },

  resolveFamilyFeudAnswer(
    eventId: string,
    sessionId: string,
    submissionId: string,
    boardAnswer: string | null,
  ) {
    const input: PrismModerateEventGameInput = {
      action: "resolve_family_feud_answer",
      idempotencyKey: idempotencyKey(),
      submissionId,
      boardAnswer,
    };
    return eventGamesHostRepository.moderate(eventId, sessionId, input);
  },

  assignAward(
    eventId: string,
    sessionId: string,
    input: Omit<PrismAssignEventGameAwardInput, "idempotencyKey">,
  ) {
    const parsed = assignEventGameAwardSchema.safeParse({
      ...input,
      idempotencyKey: idempotencyKey(),
    });
    if (!parsed.success) throw new Error("Check the award details and try again.");
    return eventGamesHostRepository.assignAward(eventId, sessionId, parsed.data);
  },
};

async function sha256(file: File): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
