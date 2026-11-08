import type { CreateProposalCommentInput, PrismProposalComment } from "@prism/types";
import { clientApiRequest } from "@/lib/prism-api";

export const proposalCommentsRepository = {
  list(eventId: string) {
    return clientApiRequest<PrismProposalComment[]>(`/events/${eventId}/proposal/comments`);
  },
  create(eventId: string, input: CreateProposalCommentInput) {
    return clientApiRequest<PrismProposalComment>(`/events/${eventId}/proposal/comments`, { method: "POST", body: input });
  },
};
