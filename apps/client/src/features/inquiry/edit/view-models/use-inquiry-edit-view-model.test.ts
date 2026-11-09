/** @vitest-environment jsdom */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PrismApiError } from "@prism/api-client";
import { useInquiryEditViewModel } from "./use-inquiry-edit-view-model";

const mocks = vi.hoisted(() => ({ getEdit: vi.fn() }));
vi.mock("../../submit/data/inquiry-repository", () => ({ inquiryRepository: mocks }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("inquiry edit link", () => {
  it("closes without asking the API when the link has no token", () => {
    const { result } = renderHook(() => useInquiryEditViewModel(""));
    expect(mocks.getEdit).not.toHaveBeenCalled();
    expect(result.current.status).toBe("closed");
    expect(result.current.closedReason).toBe("invalid");
  });

  it("tells an expired link apart from a server outage", async () => {
    mocks.getEdit.mockRejectedValueOnce(new PrismApiError(404, {}));
    const expired = renderHook(() => useInquiryEditViewModel("expired-token"));
    await waitFor(() => expect(expired.result.current.status).toBe("closed"));
    expect(expired.result.current.closedReason).toBe("invalid");

    mocks.getEdit.mockRejectedValueOnce(new PrismApiError(500, {}));
    const outage = renderHook(() => useInquiryEditViewModel("valid-token"));
    await waitFor(() => expect(outage.result.current.status).toBe("closed"));
    expect(outage.result.current.closedReason).toBe("unavailable");
  });
});
