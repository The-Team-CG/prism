import { formatPortalDate, formatPortalTime, manilaDateKey } from "../format-date";

/** The message fields the chat UI reads; portal message records satisfy this structurally. */
export type ChatMessageRecord = { id: string; senderId: string; senderRole: string; body: string; createdAt: string };
export type ChatParticipantRecord = { actorId: string; actorRole: string; active: boolean };
export type ChatThreadRecord<M extends ChatMessageRecord = ChatMessageRecord> = {
  id: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
  participants: ChatParticipantRecord[];
  messages: M[];
  messagesNextCursor?: string | null;
  unreadCount?: number;
};
export type ChatPerson = { id: string; name: string; email?: string; role?: string };

export type ChatMessage = ChatMessageRecord & { mine: boolean };
export type ChatThread = Omit<ChatThreadRecord, "messages"> & { messages: ChatMessage[] };
export type ParticipantDirectory = ReadonlyMap<string, ChatPerson>;

/** Marks the viewer's own messages and orders conversations by latest activity. */
export function toChatThreads(threads: ReadonlyArray<ChatThreadRecord>, viewerId: string | undefined): ChatThread[] {
  return sortThreadsByActivity(
    threads.map((thread) => ({ ...thread, messages: thread.messages.map((message) => ({ ...message, mine: Boolean(viewerId) && message.senderId === viewerId })) })),
  );
}

const ROLE_NAMES: Record<string, string> = {
  "pmcm-admin": "PMCM",
  pmcm_admin: "PMCM",
  client: "Client",
  coordinator: "Coordinator",
  supplier: "Supplier",
  system: "System",
};

export function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function roleName(role: string) {
  return ROLE_NAMES[role] ?? role.replaceAll(/[_-]+/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

export function senderName(message: Pick<ChatMessageRecord, "senderId" | "senderRole">, people: ParticipantDirectory) {
  return people.get(message.senderId)?.name ?? roleName(message.senderRole);
}

/** Everyone in the thread except the viewer, by name, for the conversation header and list. */
export function threadMembers(thread: Pick<ChatThreadRecord, "participants">, people: ParticipantDirectory, viewerId: string | undefined) {
  return thread.participants
    .filter((participant) => participant.active && participant.actorId !== viewerId)
    .map((participant) => people.get(participant.actorId)?.name ?? roleName(participant.actorRole));
}

export function lastMessage(thread: ChatThread): ChatMessage | undefined {
  return thread.messages[thread.messages.length - 1];
}

/** Conversations with the most recent activity first, like a phone's chat list. */
export function sortThreadsByActivity(threads: ChatThread[]) {
  const activity = (thread: ChatThread) => lastMessage(thread)?.createdAt ?? thread.updatedAt ?? thread.createdAt;
  return [...threads].sort((left, right) => activity(right).localeCompare(activity(left)));
}

export function threadPreview(thread: ChatThread, people: ParticipantDirectory) {
  const message = lastMessage(thread);
  if (!message) return "No messages yet";
  const author = message.mine ? "You" : senderName(message, people).split(" ")[0];
  return `${author}: ${message.body.replaceAll(/\s+/g, " ")}`;
}

/** List timestamp: time for today, "Yesterday", weekday within a week, otherwise the date. */
export function listTimestamp(iso: string, now = new Date()) {
  const dayKey = manilaDateKey(new Date(iso));
  const today = manilaDateKey(now);
  if (dayKey === today) return formatPortalTime(iso);
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dayKey}T00:00:00Z`)) / 86_400_000);
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return new Intl.DateTimeFormat("en-PH", { weekday: "short", timeZone: "Asia/Manila" }).format(new Date(iso));
  return formatPortalDate(iso);
}

export function daySeparatorLabel(dayKey: string, now = new Date()) {
  const today = manilaDateKey(now);
  if (dayKey === today) return "Today";
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dayKey}T00:00:00Z`)) / 86_400_000);
  if (days === 1) return "Yesterday";
  return formatPortalDate(dayKey);
}

export type MessageRun = { key: string; dayKey: string; mine: boolean; senderId: string; messages: ChatMessage[] };

/** Groups consecutive messages from the same sender on the same day, so names and avatars show once per run. */
export function messageRuns(messages: ChatMessage[]): MessageRun[] {
  const runs: MessageRun[] = [];
  for (const message of messages) {
    const dayKey = manilaDateKey(new Date(message.createdAt));
    const previous = runs[runs.length - 1];
    if (previous && previous.senderId === message.senderId && previous.dayKey === dayKey) {
      previous.messages.push(message);
      continue;
    }
    runs.push({ key: message.id, dayKey, mine: message.mine, senderId: message.senderId, messages: [message] });
  }
  return runs;
}
