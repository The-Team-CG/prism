/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismApiError } from "@prism/api-client";

const routerMock = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const routeSearchMock = vi.hoisted(() => ({ value: "" }));
const loadSupplierCategoriesMock = vi.hoisted(() => vi.fn());
const loadSupplierDirectoryMock = vi.hoisted(() => vi.fn());
const loadSupplierDetailMock = vi.hoisted(() => vi.fn());
const loadSupplierReviewsMock = vi.hoisted(() => vi.fn());
const loadSupplierCertificationsMock = vi.hoisted(() => vi.fn());
const loadSupplierRecordsMock = vi.hoisted(() => vi.fn());
const loadSupplierEngagementsMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/dashboard/suppliers",
  useSearchParams: () => new URLSearchParams(routeSearchMock.value),
}));
vi.mock("../use-cases/load-supplier-directory", () => ({
  loadSupplierCategories: loadSupplierCategoriesMock,
  loadSupplierDirectory: loadSupplierDirectoryMock,
}));
vi.mock("../use-cases/load-supplier-detail", () => ({
  loadSupplierDetail: loadSupplierDetailMock,
  loadSupplierReviews: loadSupplierReviewsMock,
  loadSupplierCertifications: loadSupplierCertificationsMock,
  loadSupplierRecords: loadSupplierRecordsMock,
  loadSupplierEngagements: loadSupplierEngagementsMock,
}));

import { useSupplierDirectoryViewModel } from "./use-supplier-directory-view-model";

const directoryPage = (name: string) => ({
  items: [{
    id: name,
    name,
    categoryId: "cat-1",
    categoryName: "Production",
    categorySlug: "production",
    tier: "tier_1",
    bniMember: false,
    contactName: "",
    email: "",
    phone: "",
    rating: { average: null, count: 0 },
    lastReviewedAt: null,
    certifications: { rejected: 0, expired: 0, submitted: 0, verified: 0, unknown: 0, attention: "none" },
  }],
  totalCount: 1,
  page: 0,
  pageSize: 25,
  hasNextPage: false,
  query: { q: "", rating: "all", sort: "name", direction: "asc", page: 0, pageSize: 25 },
  asOf: "2026-10-07T00:00:00.000Z",
});

function session(id: string) {
  return { id, name: id, role: "pmcm-admin", email: `${id}@pmcm.test`, organization: "PMCM", approvalStatus: "approved", accessToken: `token-${id}`, expiresAt: "2099-01-01", signedInAt: `signed-${id}` } as never;
}

describe("useSupplierDirectoryViewModel", () => {
  beforeEach(() => {
    vi.useRealTimers();
    routerMock.push.mockReset();
    routerMock.replace.mockReset();
    routeSearchMock.value = "";
    loadSupplierCategoriesMock.mockReset().mockResolvedValue([]);
    loadSupplierDirectoryMock.mockReset().mockResolvedValue(directoryPage("Supplier A"));
    loadSupplierDetailMock.mockReset();
    loadSupplierReviewsMock.mockReset();
    loadSupplierCertificationsMock.mockReset();
    loadSupplierRecordsMock.mockReset();
    loadSupplierEngagementsMock.mockReset();
  });

  it("does not call private supplier reads without a PMCM session", async () => {
    const { result } = renderHook(() => useSupplierDirectoryViewModel({ view: "all", session: null }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.canRead).toBe(false);
    expect(loadSupplierCategoriesMock).not.toHaveBeenCalled();
    expect(loadSupplierDirectoryMock).not.toHaveBeenCalled();
  });

  it("ignores an older directory response after a newer filter request completes", async () => {
    let resolveOld!: (value: ReturnType<typeof directoryPage>) => void;
    const oldRequest = new Promise<ReturnType<typeof directoryPage>>((resolve) => { resolveOld = resolve; });
    loadSupplierDirectoryMock.mockReturnValueOnce(oldRequest).mockResolvedValueOnce(directoryPage("Supplier B"));
    const { result } = renderHook(() => useSupplierDirectoryViewModel({ view: "all", session: session("actor-a") }));
    await waitFor(() => expect(loadSupplierDirectoryMock).toHaveBeenCalledTimes(1));

    act(() => result.current.updateQuery({ q: "newer filter" }));
    await waitFor(() => expect(loadSupplierDirectoryMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.directory?.items[0]?.name).toBe("Supplier B"));
    await act(async () => { resolveOld(directoryPage("Stale Supplier")); });

    expect(result.current.directory?.items[0]?.name).toBe("Supplier B");
  });

  it("keeps same-actor last-good rows after a transient request error and hides them on actor change", async () => {
    loadSupplierDirectoryMock.mockResolvedValueOnce(directoryPage("Supplier A")).mockRejectedValueOnce(new Error("temporary outage"));
    const { result, rerender } = renderHook(({ actor }) => useSupplierDirectoryViewModel({ view: "all", session: session(actor) }), { initialProps: { actor: "actor-a" } });
    await waitFor(() => expect(result.current.directory?.items[0]?.name).toBe("Supplier A"));

    act(() => result.current.updateQuery({ q: "retry this" }));
    await waitFor(() => expect(result.current.directoryError).toBe("temporary outage"));
    expect(result.current.directory?.items[0]?.name).toBe("Supplier A");

    rerender({ actor: "actor-b" });
    expect(result.current.directory).toBeNull();
    await waitFor(() => expect(result.current.directory?.items[0]?.name).toBe("Supplier A"));
  });

  it("clears private rows after an authorization failure", async () => {
    loadSupplierDirectoryMock.mockResolvedValueOnce(directoryPage("Supplier A")).mockRejectedValueOnce(new PrismApiError(403, { message: "Forbidden" }));
    const { result } = renderHook(() => useSupplierDirectoryViewModel({ view: "all", session: session("actor-a") }));
    await waitFor(() => expect(result.current.directory?.items[0]?.name).toBe("Supplier A"));

    act(() => result.current.updateQuery({ q: "recheck access" }));
    await waitFor(() => expect(result.current.directory).toBeNull());
  });

  it("pushes a selected supplier while retaining the list query and replaces it on close", async () => {
    routeSearchMock.value = "q=harbor&page=2&pageSize=50";
    loadSupplierDetailMock.mockResolvedValue({} as never);
    loadSupplierEngagementsMock.mockResolvedValue({ items: [], totalCount: 0, page: 0, pageSize: 25, hasNextPage: false } as never);
    loadSupplierReviewsMock.mockResolvedValue({ items: [], totalCount: 0, page: 0, pageSize: 25, hasNextPage: false } as never);
    loadSupplierCertificationsMock.mockResolvedValue({ items: [], totalCount: 0, page: 0, pageSize: 25, hasNextPage: false } as never);
    loadSupplierRecordsMock.mockResolvedValue({ items: [], totalCount: 0, page: 0, pageSize: 25, hasNextPage: false } as never);
    const sessionValue = session("actor-a");
    const { result, rerender } = renderHook(() => useSupplierDirectoryViewModel({ view: "all", session: sessionValue }));
    await waitFor(() => expect(result.current.query).toMatchObject({ q: "harbor", page: 2, pageSize: 50 }));

    act(() => result.current.openSupplier("supplier-1"));
    const pushedUrl = new URL(routerMock.push.mock.lastCall?.[0] ?? "", "http://localhost");
    expect(pushedUrl.searchParams.get("supplierId")).toBe("supplier-1");
    expect(pushedUrl.searchParams.get("q")).toBe("harbor");
    expect(pushedUrl.searchParams.get("page")).toBe("2");
    expect(pushedUrl.searchParams.get("pageSize")).toBe("50");

    routeSearchMock.value = "q=harbor&page=2&pageSize=50&supplierId=supplier-1";
    rerender();
    act(() => result.current.closeSupplier());
    const replacedUrl = new URL(routerMock.replace.mock.lastCall?.[0] ?? "", "http://localhost");
    expect(replacedUrl.searchParams.get("supplierId")).toBeNull();
    expect(replacedUrl.searchParams.get("q")).toBe("harbor");
    expect(replacedUrl.searchParams.get("page")).toBe("2");
  });

  it("refreshes on a visible-tab return only after the 30-second freshness window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T00:00:00.000Z"));
    const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const { unmount } = renderHook(() => useSupplierDirectoryViewModel({ view: "all", session: session("actor-a") }));
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(loadSupplierDirectoryMock).toHaveBeenCalledTimes(1);

    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(loadSupplierDirectoryMock).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(30_001); });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await Promise.resolve(); await Promise.resolve(); });
    expect(loadSupplierDirectoryMock).toHaveBeenCalledTimes(2);

    unmount();
    vi.useRealTimers();
    if (originalVisibility) Object.defineProperty(document, "visibilityState", originalVisibility);
    else Reflect.deleteProperty(document, "visibilityState");
  });
});
