import { describe, expect, it } from "vitest";
import { isAccessRequestValid, normalizeAccessRequest } from "./sign-up-rules";
import { INITIAL_ACCESS_REQUEST } from "./sign-up-types";

describe("sign-up-rules", () => {
  it("requires core identity fields", () => {
    expect(isAccessRequestValid(INITIAL_ACCESS_REQUEST)).toBe(false);
    expect(
      isAccessRequestValid({
        ...INITIAL_ACCESS_REQUEST,
        fullName: "Ana",
        email: "ana@test.com",
        organization: "Ayala",
        eventName: "Summit",
      }),
    ).toBe(true);
  });

  it("trims request fields", () => {
    const normalized = normalizeAccessRequest({
      fullName: "  Ana  ",
      email: " ana@test.com ",
      organization: " Ayala ",
      eventName: " Summit ",
      inquiryCode: " INQ-1 ",
      message: " Hello ",
    });
    expect(normalized.fullName).toBe("Ana");
    expect(normalized.email).toBe("ana@test.com");
    expect(normalized.inquiryCode).toBe("INQ-1");
  });
});
