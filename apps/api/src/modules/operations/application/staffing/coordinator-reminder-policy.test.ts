import { describe, expect, it } from "vitest";
import {
  coordinatorAcknowledgementLeadTimeDays,
  DEFAULT_COORDINATOR_ACKNOWLEDGEMENT_LEAD_TIME_DAYS,
} from "./coordinator-reminder-policy";

describe("coordinator acknowledgement reminder policy", () => {
  it("defaults to seven days and accepts configured whole days from same-day through one year", () => {
    expect(coordinatorAcknowledgementLeadTimeDays(undefined)).toBe(7);
    expect(coordinatorAcknowledgementLeadTimeDays("0")).toBe(0);
    expect(coordinatorAcknowledgementLeadTimeDays("14")).toBe(14);
  });

  it.each(["-1", "1.5", "366", "not-a-number"])(
    "falls back to the default for invalid configured value %s",
    (value) => {
      expect(coordinatorAcknowledgementLeadTimeDays(value)).toBe(
        DEFAULT_COORDINATOR_ACKNOWLEDGEMENT_LEAD_TIME_DAYS,
      );
    },
  );
});
