import type { ClientMessageDraftRequest, SendClientMessageInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const clientFollowUpsRepository = {
  triggers: (eventId: string) => eventApi.commercial.clientMessageTriggers(eventId),
  draft: (input: ClientMessageDraftRequest) => eventApi.commercial.draftClientMessage(input),
  send: (input: SendClientMessageInput) => eventApi.commercial.sendClientMessage(input),
};
