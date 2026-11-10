import type { CreateProposalCommentInput } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export const proposalCommentsRepository = {
  list(eventId: string) {
    return clientApi.commercial.proposalComments(eventId);
  },
  create(eventId: string, input: CreateProposalCommentInput) {
    return clientApi.commercial.addProposalComment(eventId, input);
  },
};
