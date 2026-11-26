import type {
  CreateCommunicationThreadInput,
  SendCommunicationMessageInput,
  PrismCommunicationInboxThread,
  PrismCommunicationThread,
  PrismCommunicationParticipantChoice,
  PrismCommunicationReadReceipt,
  PrismCommunicationUnreadCount,
  CommunicationUnreadCountQuery,
  AddCommunicationParticipantsInput,
  CommunicationThreadStatus,
  CommunicationInboxQuery,
  PrismCursorPage,
} from "@prism/types";

/** Paging and search for the conversation lists. Omitted fields take the API defaults: first page, open, no search. */
export type CommunicationPageRequest = Partial<CommunicationInboxQuery>;

export interface EventOpsCommunicationContract {
  communication: {
    /** One page of one event's conversations the account is in, most recent activity first. */
    listThreads(
      eventId: string,
      query?: CommunicationPageRequest,
    ): Promise<PrismCursorPage<PrismCommunicationThread>>;
    /** One conversation the account is a member of. */
    getThread(threadId: string): Promise<PrismCommunicationThread>;
    /** One page of the signed-in account's conversations across every event it can read. */
    listInbox(query?: CommunicationPageRequest): Promise<PrismCursorPage<PrismCommunicationInboxThread>>;
    /** Unread messages in the inbox, or in one event's conversations when `query.eventId` is given. */
    unreadCount(query?: CommunicationUnreadCountQuery): Promise<PrismCommunicationUnreadCount>;
    readReceipts(threadId: string): Promise<PrismCommunicationReadReceipt[]>;
    listParticipants(
      eventId: string,
    ): Promise<PrismCommunicationParticipantChoice[]>;
    createThread(
      input: CreateCommunicationThreadInput,
    ): Promise<PrismCommunicationThread>;
    sendMessage(
      threadId: string,
      input: SendCommunicationMessageInput,
    ): Promise<PrismCommunicationThread["messages"][number]>;
    listMessages(
      threadId: string,
      query?: { cursor?: string; limit?: number },
    ): Promise<
      import("@prism/types").PrismCursorPage<
        PrismCommunicationThread["messages"][number]
      >
    >;
    markThreadRead(
      threadId: string,
    ): Promise<{ lastReadAt: string }>;
    /** PMCM only: add eligible people; a removed member is reactivated. */
    addParticipants(
      threadId: string,
      input: AddCommunicationParticipantsInput,
    ): Promise<PrismCommunicationThread>;
    /** PMCM only: remove a member, who loses access at once. */
    removeParticipant(threadId: string, actorId: string): Promise<PrismCommunicationThread>;
    /** PMCM only: close a finished conversation, or reopen it. */
    setThreadStatus(threadId: string, status: CommunicationThreadStatus): Promise<PrismCommunicationThread>;
  };
}
