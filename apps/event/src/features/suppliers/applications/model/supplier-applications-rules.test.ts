import { describe, expect, it } from "vitest";
import { applicationActionLabel } from "./supplier-applications-rules";

describe("supplier-applications-rules", () => {
  it("labels inbox review actions", () => {
    expect(applicationActionLabel("request_proposal")).toBe("Request proposal");
    expect(applicationActionLabel("decline")).toBe("Decline");
  });
});
