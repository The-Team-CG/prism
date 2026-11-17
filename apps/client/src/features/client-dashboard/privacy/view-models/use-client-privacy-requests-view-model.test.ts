/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import type { PrismOwnPrivacyRequest } from "@prism/types";
import { PortalQueryProvider } from "@prism/portal-query";
import { useClientPrivacyRequestsViewModel } from "./use-client-privacy-requests-view-model";

// Each test gets its own portal cache, as each signed-in session does.
const wrapper = ({ children }: { children: ReactNode }) => createElement(PortalQueryProvider, { actorKey: "client@example.test", children });
const render = () => renderHook(() => useClientPrivacyRequestsViewModel(), { wrapper });

const { list, submit, cancel, notice, download, savePrivacyDownload } = vi.hoisted(() => ({ list: vi.fn(), submit: vi.fn(), cancel: vi.fn(), notice: vi.fn(), download: vi.fn(), savePrivacyDownload: vi.fn() }));
vi.mock("@prism/ui/privacy-requests", () => ({ savePrivacyDownload }));
vi.mock("../data/client-privacy-repository", async () => {
  const { defineResource } = await import("@prism/portal-query");
  return {
    clientPrivacyRequestRepository: { list, submit, cancel, notice, download },
    clientOwnPrivacyRequestsResource: defineResource({ name: "test.client-privacy", fetch: () => list() }),
    clientPrivacyNoticeResource: defineResource({ name: "test.client-privacy-notice", fetch: () => notice() }),
  };
});

const submitted: PrismOwnPrivacyRequest = {
  id: "priv_1",
  type: "access",
  status: "submitted",
  submittedAt: "2026-11-07T08:00:00.000Z",
  dueAt: "2026-12-07T08:00:00.000Z",
  completedAt: null,
  outcomeMessage: "Received. PMCM verifies your identity before acting on this request.",
  cancellable: true,
  identityConfirmedAt: "2026-11-07T08:00:00.000Z",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  notice.mockResolvedValue({ version: "v3", acknowledgedAt: "2026-10-27T02:00:00.000Z" });
});

describe("useClientPrivacyRequestsViewModel", () => {
  it("lists only the requests the API returns for this client", async () => {
    list.mockResolvedValue([submitted]);

    const { result } = render();

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.requests).toEqual([submitted]);
  });

  it("refuses a correction without details before calling the API", async () => {
    list.mockResolvedValue([]);
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.setRequestType("correction"));
    await act(() => result.current.submit());

    expect(submit).not.toHaveBeenCalled();
    expect(result.current.error).toBeTruthy();
  });

  it("submits a complete request with the shared contract, clears the draft, and refreshes the list", async () => {
    list.mockResolvedValueOnce([]).mockResolvedValueOnce([submitted]);
    submit.mockResolvedValue(submitted);
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      result.current.setRequestType("access");
      result.current.setDetails("Please send my records");
      result.current.setPassword("right-password");
    });
    await act(() => result.current.submit());

    expect(submit).toHaveBeenCalledWith({ requestType: "access", details: "Please send my records", password: "right-password" });
    expect(result.current.details).toBe("");
    expect(result.current.password).toBe("");
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.requests).toEqual([submitted]));
  });

  it("withdraws a request PMCM has not started and refreshes the list, and shows why when PMCM already started", async () => {
    const withdrawn = { ...submitted, status: "cancelled", cancellable: false };
    list.mockResolvedValueOnce([submitted]).mockResolvedValueOnce([withdrawn]);
    cancel.mockResolvedValueOnce(withdrawn).mockRejectedValueOnce(new Error("PMCM has already started on this request, so it can no longer be cancelled."));
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(() => result.current.cancel(submitted.id));
    expect(cancel).toHaveBeenCalledWith(submitted.id);
    await waitFor(() => expect(result.current.requests).toEqual([withdrawn]));
    expect(result.current.cancellingId).toBeNull();

    await act(() => result.current.cancel(submitted.id));
    expect(result.current.cancelError).toMatch(/already started/);
  });

  it("shows which privacy notice the client accepted, and when", async () => {
    list.mockResolvedValue([]);
    const { result } = render();
    await waitFor(() => expect(result.current.notice).toEqual({ version: "v3", acknowledgedAt: "2026-10-27T02:00:00.000Z" }));
  });

  it("downloads the data straight away for a download, saves the file, and lists it, without filing a request", async () => {
    const bundle = { requestId: "priv_9", subjectType: "client", generatedAt: "2026-11-18T01:00:00.000Z", sections: [] };
    list.mockResolvedValue([]);
    download.mockResolvedValue({ request: { ...submitted, id: "priv_9", type: "export", status: "executed" }, export: bundle });
    const { result } = render();
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      result.current.setRequestType("export");
      result.current.setPassword("right-password");
    });
    let sent = false;
    await act(async () => { sent = await result.current.submit(); });

    expect(sent).toBe(true);
    expect(download).toHaveBeenCalledWith("right-password");
    expect(savePrivacyDownload).toHaveBeenCalledWith(bundle);
    expect(submit).not.toHaveBeenCalled();
    expect(result.current.password).toBe("");
  });
});
