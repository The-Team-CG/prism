/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismCommunicationInboxThread, PrismCommunicationMessage, PrismCommunicationThread } from "@prism/types";
import { useClientMessagesViewModel } from "./use-client-messages-view-model";

const mocks = vi.hoisted(() => ({
  workspace: { selectedEvent: { id: "event-a", eventName: "Event A" }, session: { id: "client", name: "Client" } },
  list: vi.fn(),
  inbox: vi.fn(),
  send: vi.fn(),
  history: vi.fn(),
  listOlder: vi.fn(),
  markRead: vi.fn(),
}));
vi.mock("../../workspace/shared", () => ({ useClientWorkspace: () => mocks.workspace }));
vi.mock("../data/client-messages-repository", () => ({ clientMessagesRepository: mocks }));

function thread(id: string, eventId: string): PrismCommunicationThread {
  return { id, eventId, subject: id, status: "open", createdBy: "pmcm", createdAt: "", updatedAt: "", participants: [], messages: [] };
}

function message(id: string, body: string, senderId = "pmcm"): PrismCommunicationMessage {
  return { id, threadId: "thread", senderId, senderRole: senderId, body, createdAt: "2026-11-12T08:00:00.000Z" };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.workspace.selectedEvent = { id: "event-a", eventName: "Event A" };
});

describe("client messages", () => {
  it("lists every event's conversations on the account page and loads one only once it is on screen", async () => {
    const latest = message("m2", "See you at the venue");
    const row: PrismCommunicationInboxThread = { ...thread("thread", "event-b"), eventName: "Event B", lastMessage: latest, unreadCount: 2 };
    mocks.inbox.mockResolvedValue([row]);
    mocks.history.mockResolvedValue({ items: [message("m1", "Hello"), latest], nextCursor: null });
    mocks.markRead.mockResolvedValue(undefined);
    const { result } = renderHook(() => useClientMessagesViewModel(false));
    await waitFor(() => expect(result.current.chat.status).toBe("ready"));

    expect(mocks.list).not.toHaveBeenCalled();
    expect(result.current.chat.active).toMatchObject({ context: "Event B", unreadCount: 2 });
    // A phone shows the list first: nothing is read or fetched until the conversation is opened.
    expect(mocks.markRead).not.toHaveBeenCalled();
    expect(mocks.history).not.toHaveBeenCalled();

    act(() => result.current.chat.workspace.onThreadShown("thread"));
    await waitFor(() => expect(result.current.chat.active.messages.map((item) => item.body)).toEqual(["Hello", "See you at the venue"]));
    expect(mocks.markRead).toHaveBeenCalledWith("thread");
    expect(result.current.chat.active.unreadCount).toBe(0);
  });

  it("ignores an earlier event's response after switching events", async () => {
    let resolveA!: (threads: PrismCommunicationThread[]) => void;
    const pendingA = new Promise<PrismCommunicationThread[]>((resolve) => { resolveA = resolve; });
    mocks.list.mockImplementation((eventId: string) => eventId === "event-a" ? pendingA : Promise.resolve([thread("thread-b", "event-b")]));
    const { result, rerender } = renderHook(() => useClientMessagesViewModel(true));

    mocks.workspace.selectedEvent = { id: "event-b", eventName: "Event B" };
    rerender();
    await waitFor(() => expect(result.current.chat.active?.id).toBe("thread-b"));
    await act(async () => { resolveA([thread("thread-a", "event-a")]); await pendingA; });
    expect(result.current.chat.threads.map((item) => item.id)).toEqual(["thread-b"]);
  });

  it("opens the latest conversation, keeps each draft, and retries a failed send with the same key", async () => {
    mocks.list.mockResolvedValue([thread("one", "event-a"), thread("two", "event-a")]);
    const sent = message("sent", "Hello", "client");
    mocks.send.mockRejectedValueOnce(new Error("Try again")).mockResolvedValueOnce(sent);
    const { result } = renderHook(() => useClientMessagesViewModel(true));
    await waitFor(() => expect(result.current.chat.status).toBe("ready"));
    // Like a messenger app, a conversation is open straight away instead of an empty pane.
    expect(["one", "two"]).toContain(result.current.chat.active?.id);
    const chat = () => result.current.chat.workspace;

    act(() => chat().onOpenThread("one"));
    act(() => chat().onDraftChange("Hello"));
    act(() => chat().onOpenThread("two"));
    expect(chat().draft).toBe("");
    act(() => chat().onOpenThread("one"));
    expect(chat().draft).toBe("Hello");

    await act(async () => { await result.current.chat.send(); });
    expect(chat().error).toBe("Try again");
    expect(chat().draft).toBe("Hello");
    await act(async () => { await result.current.chat.send(); });
    expect(mocks.send.mock.calls[0][2]).toBe(mocks.send.mock.calls[1][2]);
    expect(chat().draft).toBe("");
    expect(result.current.chat.active.messages).toEqual([{ ...sent, mine: true }]);
  });

  it("does not put a completed send into a different event after switching", async () => {
    mocks.list.mockImplementation((eventId: string) => Promise.resolve([thread(`thread-${eventId}`, eventId)]));
    let resolveSend!: (sent: PrismCommunicationMessage) => void;
    const pendingSend = new Promise<PrismCommunicationMessage>((resolve) => { resolveSend = resolve; });
    mocks.send.mockReturnValue(pendingSend);
    const { result, rerender } = renderHook(() => useClientMessagesViewModel(true));
    await waitFor(() => expect(result.current.chat.active?.id).toBe("thread-event-a"));
    act(() => result.current.chat.workspace.onDraftChange("For event A"));
    let sending!: Promise<void>;
    act(() => { sending = result.current.chat.send(); });

    mocks.workspace.selectedEvent = { id: "event-b", eventName: "Event B" };
    rerender();
    await waitFor(() => expect(result.current.chat.active?.id).toBe("thread-event-b"));
    await act(async () => {
      resolveSend(message("sent-a", "For event A", "client"));
      await sending;
    });
    expect(result.current.chat.active.messages).toEqual([]);
  });
});
