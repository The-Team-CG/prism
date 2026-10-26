import { describe, expect, it } from "vitest";
import { activationProgress, canSubmitActivation, isUsableActivationToken } from "./activate-model";

describe("activation token", () => {
  it.each([
    ["", false],
    ["x".repeat(31), false],
    ["x".repeat(32), true],
    ["x".repeat(64), true],
  ])("treats token %j as usable: %s", (token, usable) => {
    expect(isUsableActivationToken(token)).toBe(usable);
  });
});

describe("activation password", () => {
  it.each([
    { name: "too short", password: "x".repeat(11), confirm: "x".repeat(11), allowed: false },
    { name: "exactly 12", password: "x".repeat(12), confirm: "x".repeat(12), allowed: true },
    { name: "exactly 128", password: "x".repeat(128), confirm: "x".repeat(128), allowed: true },
    { name: "too long", password: "x".repeat(129), confirm: "x".repeat(129), allowed: false },
    { name: "blank", password: " ".repeat(12), confirm: " ".repeat(12), allowed: false },
    { name: "confirm mismatch", password: "x".repeat(12), confirm: "x".repeat(13), allowed: false },
    { name: "both empty", password: "", confirm: "", allowed: false },
  ])("$name", ({ password, confirm, allowed }) => {
    expect(canSubmitActivation(password, confirm)).toBe(allowed);
  });
});

describe("activation steps", () => {
  it("numbers the password step and the done step within the two-step flow", () => {
    expect(activationProgress("set")).toEqual({ current: 1, total: 2, label: "Set your password" });
    expect(activationProgress("done")).toEqual({ current: 2, total: 2, label: "You're all set" });
  });
});
