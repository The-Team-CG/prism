import type { CreateProposalCommentInput, PrismProposalComment } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const proposalCommentsRepository = {
  list: (eventId: string) => eventApiRequest<PrismProposalComment[]>(`/api/events/${eventId}/proposal/comments`),
  create: (eventId: string, input: CreateProposalCommentInput) =>
    eventApiRequest<PrismProposalComment>(`/api/events/${eventId}/proposal/comments`, { method: "POST", body: input }),
};
