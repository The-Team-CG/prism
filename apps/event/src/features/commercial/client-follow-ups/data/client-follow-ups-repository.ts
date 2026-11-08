import type { ClientMessageDraftRequest, CommsDraftResult, PrismClientMessageTriggerState, SendClientMessageInput } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const clientFollowUpsRepository = {
  triggers: (eventId: string) => eventApiRequest<PrismClientMessageTriggerState[]>(`/api/events/${eventId}/client-message-triggers`),
  draft: (input: ClientMessageDraftRequest) =>
    eventApiRequest<{ draft: CommsDraftResult; requestId: string; modelVersion: string }>("/api/client-message-drafts", { method: "POST", body: input }),
  send: (input: SendClientMessageInput) => eventApiRequest<{ sent: boolean }>("/api/client-message-drafts/send", { method: "POST", body: input }),
};
