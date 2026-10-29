/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismCommunicationMessage, PrismCommunicationThread } from "@prism/types";
import { useClientMessagesViewModel } from "./use-client-messages-view-model";

const mocks = vi.hoisted(() => ({
  workspace: { selectedEvent: { id: "event-a", eventName: "Event A" }, session: { name: "Client" } },
  list: vi.fn(),
  send: vi.fn(),
  listOlder: vi.fn(),
  markRead: vi.fn(),
}));
vi.mock("../../workspace/shared", () => ({ useClientWorkspace: () => mocks.workspace }));
vi.mock("../data/client-messages-repository", () => ({ clientMessagesRepository: mocks }));

function thread(id: string, eventId: string): PrismCommunicationThread {
  return { id, eventId, subject: id, status: "open", createdBy: "pmcm", createdAt: "", updatedAt: "", participants: [], messages: [] };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.workspace.selectedEvent = { id: "event-a", eventName: "Event A" };
});

describe("client messages", () => {
  it("does not load or mark conversations read on the account event picker", () => {
    renderHook(() => useClientMessagesViewModel(false));
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.markRead).not.toHaveBeenCalled();
  });

  it("ignores an earlier event's response after switching events", async () => {
    let resolveA!: (threads: PrismCommunicationThread[]) => void;
    const pendingA = new Promise<PrismCommunicationThread[]>((resolve) => { resolveA = resolve; });
    mocks.list.mockImplementation((eventId: string) => eventId === "event-a" ? pendingA : Promise.resolve([thread("thread-b", "event-b")]));
    mocks.markRead.mockResolvedValue(undefined);
    const { result, rerender } = renderHook(() => useClientMessagesViewModel());

    mocks.workspace.selectedEvent = { id: "event-b", eventName: "Event B" };
    rerender();
    await waitFor(() => expect(result.current.activeThread?.id).toBe("thread-b"));
    await act(async () => { resolveA([thread("thread-a", "event-a")]); await pendingA; });
    expect(result.current.activeThread?.id).toBe("thread-b");
    expect(result.current.threads.map((item) => item.eventId)).toEqual(["event-b"]);
  });

  it("opens the latest conversation, keeps each draft, and retries a failed send with the same key", async () => {
    mocks.list.mockResolvedValue([thread("one", "event-a"), thread("two", "event-a")]);
    mocks.markRead.mockResolvedValue(undefined);
    const sent: PrismCommunicationMessage = { id: "message", threadId: "one", senderId: "client", senderRole: "client", body: "Hello", createdAt: "" };
    mocks.send.mockRejectedValueOnce(new Error("Try again")).mockResolvedValueOnce(sent);
    const { result } = renderHook(() => useClientMessagesViewModel());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    // Like a messenger app, a conversation is open straight away instead of an empty pane.
    expect(["one", "two"]).toContain(result.current.activeThread?.id);

    act(() => result.current.selectThread("one"));
    act(() => result.current.updateDraft("Hello"));
    act(() => result.current.selectThread("two"));
    expect(result.current.draft).toBe("");
    act(() => result.current.selectThread("one"));
    expect(result.current.draft).toBe("Hello");

    await act(async () => { await result.current.sendMessage(); });
    expect(result.current.error).toBe("Try again");
    expect(result.current.draft).toBe("Hello");
    await act(async () => { await result.current.sendMessage(); });
    expect(mocks.send.mock.calls[0][2]).toBe(mocks.send.mock.calls[1][2]);
    expect(result.current.draft).toBe("");
    expect(result.current.activeThread?.messages).toEqual([sent]);
  });

  it("does not put a completed send into a different event after switching", async () => {
    mocks.list.mockImplementation((eventId: string) => Promise.resolve([thread(`thread-${eventId}`, eventId)]));
    mocks.markRead.mockResolvedValue(undefined);
    let resolveSend!: (message: PrismCommunicationMessage) => void;
    const pendingSend = new Promise<PrismCommunicationMessage>((resolve) => { resolveSend = resolve; });
    mocks.send.mockReturnValue(pendingSend);
    const { result, rerender } = renderHook(() => useClientMessagesViewModel());
    await waitFor(() => expect(result.current.activeThread?.id).toBe("thread-event-a"));
    act(() => result.current.updateDraft("For event A"));
    let sending!: Promise<void>;
    act(() => { sending = result.current.sendMessage(); });

    mocks.workspace.selectedEvent = { id: "event-b", eventName: "Event B" };
    rerender();
    await waitFor(() => expect(result.current.activeThread?.id).toBe("thread-event-b"));
    await act(async () => {
      resolveSend({ id: "sent-a", threadId: "thread-event-a", senderId: "client", senderRole: "client", body: "For event A", createdAt: "" });
      await sending;
    });
    expect(result.current.activeThread?.messages).toEqual([]);
  });
});
