import { describe, expect, it } from "vitest";
import { clientChangeRequestStatusLabel } from "./client-change-request-rules";

describe("clientChangeRequestStatusLabel", () => {
  it("uses neutral client wording for each status", () => {
    expect(clientChangeRequestStatusLabel("under_review")).toBe("Under review");
    expect(clientChangeRequestStatusLabel("approved")).toBe("Approved");
    expect(clientChangeRequestStatusLabel("not_approved")).toBe("Not approved");
  });
});
