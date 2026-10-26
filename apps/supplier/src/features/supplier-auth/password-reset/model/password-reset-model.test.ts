import { describe, expect, it } from "vitest";
import { newPasswordChecks } from "../../new-password/model/new-password-rules";
import { passwordResetProgress, passwordResetSentCopy } from "./password-reset-model";

describe("password reset steps", () => {
  it("numbers each view within the three-step flow", () => {
    expect(passwordResetProgress("request")).toEqual({ current: 1, total: 3, label: "Enter your email" });
    expect(passwordResetProgress("check")).toEqual({ current: 2, total: 3, label: "Check your email" });
    expect(passwordResetProgress("set")).toEqual({ current: 3, total: 3, label: "Set a new password" });
    expect(passwordResetProgress("done")).toEqual({ current: 3, total: 3, label: "Password updated" });
  });
});

describe("password reset checklist", () => {
  it("ticks length and match rules as the passwords change", () => {
    const metIds = (password: string, confirm: string) =>
      newPasswordChecks(password, confirm)
        .filter((check) => check.met)
        .map((check) => check.id);

    expect(metIds("", "")).toEqual([]);
    expect(metIds("short-pass", "short-pass")).toEqual(["match"]);
    expect(metIds("long-enough-pass", "long-enough-pass")).toEqual(["length", "match"]);
    expect(metIds("long-enough-pass", "different-pass")).toEqual(["length"]);
    expect(metIds("x".repeat(129), "x".repeat(129))).toEqual(["match"]);
  });
});

describe("password reset check-your-email copy", () => {
  it("says a link was sent without revealing whether the account exists", () => {
    expect(passwordResetSentCopy("ana@ayala.test")).toBe(
      "If an account exists for ana@ayala.test, we sent a reset link. It expires in 15 minutes.",
    );
  });
});
