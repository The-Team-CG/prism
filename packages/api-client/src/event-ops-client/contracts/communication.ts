import type {
  CreateCommunicationThreadInput,
  SendCommunicationMessageInput,
  PrismCommunicationThread,
  PrismCommunicationParticipantChoice,
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives";

export interface EventOpsCommunicationContract {
  communication: {
    listThreads(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismCommunicationThread[]>;
    listParticipants(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismCommunicationParticipantChoice[]>;
    createThread(
      input: CreateCommunicationThreadInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismCommunicationThread>;
    sendMessage(
      threadId: string,
      input: SendCommunicationMessageInput,
      actor?: EventOpsActorQuery,
    ): Promise<PrismCommunicationThread["messages"][number]>;
    listMessages(
      threadId: string,
      query?: { cursor?: string; limit?: number },
      actor?: EventOpsActorQuery,
    ): Promise<
      import("@prism/types").PrismCursorPage<
        PrismCommunicationThread["messages"][number]
      >
    >;
    markThreadRead(
      threadId: string,
      actor?: EventOpsActorQuery,
    ): Promise<{ lastReadAt: string }>;
  };
}
