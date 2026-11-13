import { describe, expect, it } from "vitest";
import { mergeRefreshedThreads, type ChatThreadRecord } from "@prism/ui/chat";

const message = (id: string, minute: number) => ({ id, senderId: "u_client", senderRole: "client", body: id, createdAt: `2026-11-14T10:${String(minute).padStart(2, "0")}:00.000Z` });
const thread = (id: string, messages: ReturnType<typeof message>[], extra: Partial<ChatThreadRecord> = {}): ChatThreadRecord => ({
  id, subject: id, createdAt: "2026-11-14T09:00:00.000Z", updatedAt: "2026-11-14T10:00:00.000Z", participants: [], messages, unreadCount: 0, ...extra,
});

describe("merging a refreshed conversation list", () => {
  it("keeps the open conversation's older history and appends only messages with new ids", () => {
    const current = [thread("open", [message("m1", 1), message("m2", 2), message("m3", 3)], { messagesNextCursor: "older" })];
    const incoming = [thread("open", [message("m3", 3), message("m4", 4)], { unreadCount: 1 })];
    const [merged] = mergeRefreshedThreads(current, incoming, { threadId: "open", page: null });
    expect(merged.messages.map((item) => item.id)).toEqual(["m1", "m2", "m3", "m4"]);
    expect(merged.messagesNextCursor).toBe("older");
    // It is on screen, so the arrival is read rather than counted as unread.
    expect(merged.unreadCount).toBe(0);
  });

  it("takes the latest page of an open inbox row, which only carried its last message, and its cursor", () => {
    const current = [thread("open", [message("m3", 3)])];
    const page = { items: [message("m1", 1), message("m2", 2), message("m3", 3)], nextCursor: "older" };
    const [merged] = mergeRefreshedThreads(current, [thread("open", [message("m3", 3)])], { threadId: "open", page });
    expect(merged.messages.map((item) => item.id)).toEqual(["m1", "m2", "m3"]);
    expect(merged.messagesNextCursor).toBe("older");
  });

  it("refreshes order, previews and unread counts of other conversations from the list", () => {
    const current = [thread("a", [message("a1", 1)], { unreadCount: 0 }), thread("b", [message("b1", 2)])];
    const incoming = [thread("b", [message("b1", 2), message("b2", 5)], { unreadCount: 2 }), thread("a", [message("a1", 1)], { unreadCount: 1 })];
    const merged = mergeRefreshedThreads(current, incoming, { threadId: undefined, page: null });
    expect(merged.map((item) => [item.id, item.unreadCount, item.messages.length])).toEqual([["b", 2, 2], ["a", 1, 1]]);
  });

  it("keeps the open conversation when a list fetched before it was created does not include it, and drops other vanished ones", () => {
    const current = [thread("new", [message("n1", 1)]), thread("gone", [message("g1", 1)])];
    const merged = mergeRefreshedThreads(current, [], { threadId: "new", page: null });
    expect(merged.map((item) => item.id)).toEqual(["new"]);
  });
});
