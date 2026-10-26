import { describe, expect, it } from "vitest";
import { activationPasswordError, activationProgress, isActivationTokenUsable } from "./activate-model";

describe("activation link token", () => {
  it("accepts a token of at least 32 characters and rejects empty or short ones", () => {
    expect(isActivationTokenUsable("a".repeat(32))).toBe(true);
    expect(isActivationTokenUsable("")).toBe(false);
    expect(isActivationTokenUsable("   ")).toBe(false);
    expect(isActivationTokenUsable("a".repeat(31))).toBe(false);
  });
});

describe("activation password rule", () => {
  it.each([
    { label: "too short", password: "x".repeat(11), confirm: "x".repeat(11), error: "Password must be at least 12 characters" },
    { label: "exactly 12 characters", password: "x".repeat(12), confirm: "x".repeat(12), error: null },
    { label: "exactly 128 characters", password: "x".repeat(128), confirm: "x".repeat(128), error: null },
    { label: "too long", password: "x".repeat(129), confirm: "x".repeat(129), error: "Password must be at most 128 characters" },
    { label: "blank", password: " ".repeat(12), confirm: " ".repeat(12), error: "Password cannot be blank" },
    { label: "confirmation does not match", password: "long-enough-pass", confirm: "other-long-pass", error: "Passwords do not match." },
  ])("$label", ({ password, confirm, error }) => {
    expect(activationPasswordError(password, confirm)).toBe(error);
  });
});

describe("activation progress", () => {
  it("shows step 1 while setting the password and step 2 once the account is active", () => {
    expect(activationProgress("set")).toEqual({ current: 1, total: 2, label: "Set your password" });
    expect(activationProgress("done")).toEqual({ current: 2, total: 2, label: "You're all set" });
  });
});
