import type {
  CreateCommunicationThreadInput,
  SendCommunicationMessageInput,
  PrismCommunicationInboxThread,
  PrismCommunicationThread,
  PrismCommunicationParticipantChoice,
  PrismCommunicationReadReceipt,
  PrismCommunicationUnreadCount,
  CommunicationUnreadCountQuery,
} from "@prism/types";
import type { EventOpsActorQuery } from "./primitives";

export interface EventOpsCommunicationContract {
  communication: {
    listThreads(
      eventId: string,
      actor?: EventOpsActorQuery,
    ): Promise<PrismCommunicationThread[]>;
    /** The signed-in account's conversations across every event it can read. */
    listInbox(actor?: EventOpsActorQuery): Promise<PrismCommunicationInboxThread[]>;
    /** Unread messages in the inbox, or in one event's conversations when `query.eventId` is given. */
    unreadCount(query?: CommunicationUnreadCountQuery, actor?: EventOpsActorQuery): Promise<PrismCommunicationUnreadCount>;
    readReceipts(threadId: string, actor?: EventOpsActorQuery): Promise<PrismCommunicationReadReceipt[]>;
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
