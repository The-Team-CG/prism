/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import type { PrismOwnPrivacyRequest } from "@prism/types";
import { PortalQueryProvider } from "@prism/portal-query";
import { useClientPrivacyRequestsViewModel } from "./use-client-privacy-requests-view-model";

// Each test gets its own portal cache, as each signed-in session does.
const wrapper = ({ children }: { children: ReactNode }) => createElement(PortalQueryProvider, { actorKey: "client@example.test", children });
const render = () => renderHook(() => useClientPrivacyRequestsViewModel(), { wrapper });

const { list, submit } = vi.hoisted(() => ({ list: vi.fn(), submit: vi.fn() }));
vi.mock("../data/client-privacy-repository", async () => {
  const { defineResource } = await import("@prism/portal-query");
  return {
    clientPrivacyRequestRepository: { list, submit },
    clientOwnPrivacyRequestsResource: defineResource({ name: "test.client-privacy", fetch: () => list() }),
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
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
    });
    await act(() => result.current.submit());

    expect(submit).toHaveBeenCalledWith({ requestType: "access", details: "Please send my records" });
    expect(result.current.details).toBe("");
    expect(result.current.error).toBeNull();
    await waitFor(() => expect(result.current.requests).toEqual([submitted]));
  });
});
