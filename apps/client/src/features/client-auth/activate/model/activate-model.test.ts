import { describe, expect, it } from "vitest";
import {
  canSubmitActivationPassword,
  isUsableActivationToken,
} from "./activate-model";

describe("activation token", () => {
  it("accepts only tokens the API would accept (32+ characters after trimming)", () => {
    const token = "a".repeat(32);
    expect(isUsableActivationToken(token)).toBe(true);
    expect(isUsableActivationToken(`  ${token}  `)).toBe(true);
    expect(isUsableActivationToken("a".repeat(31))).toBe(false);
    expect(isUsableActivationToken("   ")).toBe(false);
    expect(isUsableActivationToken("")).toBe(false);
  });
});

describe("activation password", () => {
  const cases: Array<[string, string, boolean]> = [
    ["short-pass", "short-pass", false],
    ["x".repeat(11), "x".repeat(11), false],
    ["x".repeat(12), "x".repeat(12), true],
    ["x".repeat(128), "x".repeat(128), true],
    ["x".repeat(129), "x".repeat(129), false],
    ["long-enough-pass", "different-pass", false],
    ["long-enough-pass", "", false],
  ];

  it.each(cases)("password of %j with confirmation %j is submittable: %s", (password, confirm, expected) => {
    expect(canSubmitActivationPassword(password, confirm)).toBe(expected);
  });
});
