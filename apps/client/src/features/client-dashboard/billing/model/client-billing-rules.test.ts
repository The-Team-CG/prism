import { describe, expect, it } from "vitest";
import { clientMilestoneFollowUpCopy, clientMilestoneRemaining } from "./client-billing-rules";

describe("client-billing-rules", () => {
  it("prefers remainingBalance and explains unpaid follow-up", () => {
    expect(clientMilestoneRemaining({ amount: 100, amountPaid: 40, remainingBalance: 60 })).toBe(60);
    expect(clientMilestoneRemaining({ amount: 100, amountPaid: 25 })).toBe(75);
    expect(clientMilestoneFollowUpCopy(0)).toBe("This milestone is settled.");
    expect(clientMilestoneFollowUpCopy(10)).toMatch(/Remaining balance/);
  });
});
