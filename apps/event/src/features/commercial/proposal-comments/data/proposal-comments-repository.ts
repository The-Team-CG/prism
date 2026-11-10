import type { CreateProposalCommentInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const proposalCommentsRepository = {
  list: (eventId: string) => eventApi.commercial.proposalComments(eventId),
  create: (eventId: string, input: CreateProposalCommentInput) => eventApi.commercial.addProposalComment(eventId, input),
};
