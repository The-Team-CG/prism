/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismPrivacyRequest } from "@prism/types";
import { PrivacyConsoleView } from "./privacy-console-view";

const { repository, storedSession, retentionLoad } = vi.hoisted(() => ({
  repository: {
    loadContext: vi.fn(),
    queue: vi.fn(),
    loadLegalHolds: vi.fn(),
    createRequest: vi.fn(),
    assignRequest: vi.fn(),
    reviewRequest: vi.fn(),
    executeRequest: vi.fn(),
    createLegalHold: vi.fn(),
    releaseLegalHold: vi.fn(),
  },
  storedSession: { current: null as unknown },
  retentionLoad: vi.fn(),
}));

vi.mock("@/features/privacy/retention/use-cases/retention-use-cases", () => ({ retentionUseCases: { load: retentionLoad } }));
vi.mock("../data/privacy-console-repository", () => ({ privacyConsoleRepository: repository }));
vi.mock("@/app/lib/session", () => ({ readStoredEventSession: () => storedSession.current }));

function privacyRequest(overrides: Partial<PrismPrivacyRequest>): PrismPrivacyRequest {
  return {
    id: "priv_1",
    eventId: "evt_1",
    subjectType: "guest",
    subjectEmail: "",
    subjectName: "Ana Reyes",
    requestType: "deletion",
    status: "submitted",
    requestNotes: "",
    reviewReason: "",
    executionNotes: "",
    createdBy: "usr_maxine",
    reviewedBy: null,
    reviewedAt: null,
    executedBy: null,
    executedAt: null,
    dueAt: "2026-10-01T00:00:00.000Z",
    overdue: true,
    assignedTo: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function page(items: PrismPrivacyRequest[]) {
  return { items, page: 0, limit: 25, total: items.length, hasMore: false };
}

const operator = { id: "usr_maxine", role: "pmcm-admin", name: "Maxine" };

beforeEach(() => {
  storedSession.current = operator;
  retentionLoad.mockResolvedValue({ policies: [], items: [] });
  repository.loadContext.mockResolvedValue({ events: [], users: [{ id: "usr_maxine", name: "Maxine" }] });
  repository.loadLegalHolds.mockResolvedValue([]);
  repository.queue.mockResolvedValue(page([]));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PrivacyConsoleView", () => {
  it("flags an overdue open request and assigns it to the signed-in operator, then reloads the queue", async () => {
    const overdue = privacyRequest({ id: "priv_overdue", overdue: true, dueAt: "2026-10-01T00:00:00.000Z" });
    repository.queue.mockResolvedValueOnce(page([overdue])).mockResolvedValueOnce(page([{ ...overdue, assignedTo: "usr_maxine" }]));
    repository.assignRequest.mockResolvedValue({ ...overdue, assignedTo: "usr_maxine" });

    render(<PrivacyConsoleView />);

    expect(await screen.findByText(/^Overdue by \d+ days? \(due 2026-10-01\)$/)).toBeTruthy();
    expect(await screen.findByText("Retention policies and review queue")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Assign to me" }));

    await waitFor(() => expect(repository.assignRequest).toHaveBeenCalledWith("priv_overdue", { assignedTo: "usr_maxine" }));
    await waitFor(() => expect(repository.queue).toHaveBeenCalledTimes(2));
  });

  it("queries only the operator's own requests when the owner filter is set to mine", async () => {
    render(<PrivacyConsoleView />);
    await screen.findByText("No privacy requests match these filters.");

    fireEvent.change(screen.getByLabelText("Filter by owner"), { target: { value: "mine" } });

    await waitFor(() => expect(repository.queue).toHaveBeenLastCalledWith(expect.objectContaining({ assignedTo: "usr_maxine", page: 0 })));
  });

  it("applies a guest name correction to an approved correction request through the console", async () => {
    const approved = privacyRequest({ id: "priv_guest", status: "approved", requestType: "correction", overdue: true, assignedTo: "usr_maxine" });
    repository.queue.mockResolvedValue(page([approved]));
    repository.executeRequest.mockResolvedValue({ ...approved, status: "executed", export: null });

    render(<PrivacyConsoleView />);
    fireEvent.change(await screen.findByLabelText("Corrected name"), { target: { value: "Ana R. Reyes" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply correction" }));

    await waitFor(() => expect(repository.executeRequest).toHaveBeenCalledWith(
      "priv_guest", "Executed from PMCM privacy console.", { name: "Ana R. Reyes" },
    ));
  });

  it("hides assignment, legal hold, and retention controls from a non-operator session", async () => {
    storedSession.current = { id: "usr_coord", role: "coordinator", name: "Coordinator" };
    repository.queue.mockResolvedValue(page([privacyRequest({ id: "priv_visible", status: "approved", requestType: "deletion" })]));

    render(<PrivacyConsoleView />);

    expect(await screen.findByRole("button", { name: "Execute" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Assign to me" })).toBeNull();
    expect(screen.queryByText("Legal holds")).toBeNull();
    expect(repository.loadLegalHolds).not.toHaveBeenCalled();
    expect(retentionLoad).not.toHaveBeenCalled();
  });
});
