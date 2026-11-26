import { describe, expect, it } from "vitest";
import type { PrismInquiry } from "@prism/types";
import {
  AWAITING_REVIEW,
  canMergeInquiry,
  compareIntakeInquiries,
  inquiryExtraDetailFields,
  inquiryHistoryCues,
  inquiryMatchesIntakeFilters,
  clientInquiryHistory,
  inquiryFunnel,
  inquiryMergeCandidates,
  inquiryNextStep,
  inquiryLogMissingFields,
  inquiryWaitingAge,
  isInquiryLogFormReady,
  toLogInquiryInput,
  initialLogForm,
} from "./inquiry-intake-rules";

function inquiryRow(overrides: Partial<PrismInquiry>): PrismInquiry {
  return {
    id: "inq_a",
    clientName: "Ada",
    companyName: "Acme",
    email: "ada@acme.test",
    eventName: "Gala",
    eventType: "Gala",
    eventDate: "2099-01-15",
    clientType: "Corporate",
    source: "Website",
    message: "",
    status: "new",
    createdAt: "2026-05-01T00:00:00.000Z",
    organizationKey: "acme",
    ...overrides,
  };
}

describe("inquiry-intake-rules", () => {
  it("matches intake filters", () => {
    const inquiry = {
      clientName: "Ada",
      companyName: "Acme",
      email: "ada@acme.test",
      eventName: "Gala",
      status: "new",
      source: "Walk-In",
      clientType: "Corporate",
      eventDate: "2099-01-15",
    };
    expect(inquiryMatchesIntakeFilters(inquiry, {
      query: "ada",
      status: "all",
      source: "all",
      clientType: "all",
      dateRange: "all",
    })).toBe(true);
    expect(inquiryMatchesIntakeFilters(inquiry, {
      query: "",
      status: "accepted",
      source: "all",
      clientType: "all",
      dateRange: "all",
    })).toBe(false);
    const awaiting = { query: "", status: AWAITING_REVIEW, source: "all", clientType: "all", dateRange: "all" };
    expect(inquiryMatchesIntakeFilters(inquiry, awaiting)).toBe(true);
    expect(inquiryMatchesIntakeFilters({ ...inquiry, status: "accepted" }, awaiting)).toBe(false);
  });

  it("lists undecided inquiries before older decided ones", () => {
    const rows = [
      inquiryRow({ id: "accepted_new", status: "accepted", createdAt: "2026-06-01T00:00:00.000Z" }),
      inquiryRow({ id: "awaiting_old", status: "new", createdAt: "2026-05-01T00:00:00.000Z" }),
    ];
    expect(rows.sort(compareIntakeInquiries).map((row) => row.id)).toEqual(["awaiting_old", "accepted_new"]);
  });

  it("collects extra detail fields", () => {
    expect(inquiryExtraDetailFields({
      referralDetails: "BNI",
      channel: "Phone",
    } as never)).toEqual([
      { label: "Referral", value: "BNI" },
      { label: "Channel", value: "Phone" },
    ]);
    expect(inquiryExtraDetailFields({
      seatingArrangement: "Banquet rounds",
      stagePosition: "Centre",
      setupNotes: "Sponsor wall",
    } as never)).toEqual([
      { label: "Seating", value: "Banquet rounds" },
      { label: "Stage", value: "Centre" },
      { label: "Setup notes", value: "Sponsor wall" },
    ]);
    expect(inquiryExtraDetailFields({
      previouslyDeclined: true,
      previousDeclineReason: "Date conflict",
    } as never)).toEqual([
      { label: "Previously declined", value: "Yes" },
      { label: "Previous decline", value: "Date conflict" },
    ]);
  });

  it("saves on basic detail only, leaves blank optional fields out of the request, and trims the rest", () => {
    expect(isInquiryLogFormReady(initialLogForm)).toBe(false);
    // Channel and referral source are not guessed: they stay unset until the operator picks them.
    expect(initialLogForm).toMatchObject({ channel: "", source: "" });
    expect(inquiryLogMissingFields(initialLogForm)).toEqual(["Client name", "Email", "Event name", "Event date"]);
    const basicOnly = { ...initialLogForm, clientName: "Ada", email: "ada@acme.test", eventName: "Gala", eventDate: "2099-01-15" };
    expect(isInquiryLogFormReady(basicOnly)).toBe(true);
    expect(toLogInquiryInput(basicOnly)).toEqual({
      clientName: "Ada",
      companyName: undefined,
      email: "ada@acme.test",
      eventName: "Gala",
      eventType: undefined,
      eventDate: "2099-01-15",
      clientType: undefined,
      source: undefined,
      channel: undefined,
      referralDetails: undefined,
      message: undefined,
    });
    const ready = {
      ...initialLogForm,
      clientName: "Ada",
      email: "ada@acme.test",
      eventName: "Gala",
      eventType: "Gala",
      eventDate: "2099-01-15",
      clientType: "Corporate",
      source: "BNI Referral",
      channel: "Phone",
      companyName: "  Acme  ",
      referralDetails: "  friend  ",
      message: "Need a venue",
    };
    expect(isInquiryLogFormReady(ready)).toBe(true);
    expect(toLogInquiryInput(ready)).toMatchObject({
      companyName: "Acme",
      referralDetails: "friend",
    });
  });

  it("offers merge candidates only for open inquiries sharing an organization or contact email", () => {
    const source = inquiryRow({ id: "inq_a" });
    const sameOrg = inquiryRow({ id: "inq_b", email: "other@acme.test" });
    const sameEmail = inquiryRow({ id: "inq_c", companyName: "", organizationKey: null });
    const unrelated = inquiryRow({ id: "inq_d", companyName: "Other", organizationKey: "other", email: "x@other.test" });
    const alreadyMerged = inquiryRow({ id: "inq_e", mergedIntoInquiryId: "inq_b" });

    expect(inquiryMergeCandidates(source, [source, sameOrg, sameEmail, unrelated, alreadyMerged]).map((item) => item.id))
      .toEqual(["inq_b", "inq_c"]);
    expect(inquiryMergeCandidates(inquiryRow({ id: "inq_f", companyName: "", organizationKey: null, email: "nobody@test" }), [sameOrg])).toEqual([]);
  });

  it("blocks merging accepted or already merged inquiries", () => {
    expect(canMergeInquiry({ status: "accepted", mergedIntoInquiryId: null })).toBe(false);
    expect(canMergeInquiry({ status: "pending", mergedIntoInquiryId: "inq_b" })).toBe(false);
    expect(canMergeInquiry({ status: "new", mergedIntoInquiryId: null })).toBe(true);
  });

  it("explains duplicate, decline, parallel, and merge history on the inquiry", () => {
    const primary = inquiryRow({ id: "inq_primary", clientName: "Ana", eventName: "Summit" });
    const duplicate = inquiryRow({
      id: "inq_dup",
      duplicateOfInquiryId: "inq_primary",
      previouslyDeclined: true,
      previousDeclineReason: "Budget Too Low",
      parallelInquiryIds: ["inq_primary", "inq_third"],
      mergeHistory: [{
        id: "m1", primaryInquiryId: "inq_dup", mergedInquiryId: "inq_old", mergedInquiryName: "Old Lead",
        matchBasis: "email", reason: "Same contact", actorName: "M. Reyes", actorRole: "pmcm-admin", createdAt: "2026-05-02T00:00:00.000Z",
      }],
    });

    expect(inquiryHistoryCues(duplicate, [primary, duplicate])).toEqual([
      "Possible duplicate of Ana (Summit)",
      "Previously declined: Budget Too Low",
      "2 other open inquiries for this organization",
      "Merged Old Lead in by M. Reyes on email match: Same contact",
    ]);
    expect(inquiryHistoryCues(inquiryRow({ id: "inq_x", mergedIntoInquiryId: "inq_gone" }), [])).toEqual([
      "Merged into inq_gone",
    ]);
  });
});

describe("inquiryNextStep", () => {
  const base = { status: "accepted", conformeSentAt: null, conformeSignedAt: null, portalInvitationStatus: "not_sent", portalActivatedAt: null };
  it.each([
    [{ ...base, status: "new" }, "Review inquiry"],
    [{ ...base, status: "pending" }, "Review inquiry"],
    [{ ...base, status: "declined" }, "Declined"],
    // Briefing and proposal come before the conforme (UAT 4.1).
    [base, "Briefing & proposal in Events"],
    [{ ...base, conformeSentAt: "2026-10-01" }, "Waiting for signed conforme"],
    [{ ...base, conformeSentAt: "2026-10-01", conformeSignedAt: "2026-10-03" }, "Send client invitation"],
    [{ ...base, conformeSignedAt: "2026-10-03", portalInvitationStatus: "sent" }, "Waiting for client to activate"],
    [{ ...base, conformeSignedAt: "2026-10-03", portalInvitationStatus: "expired" }, "Re-send client invitation"],
    [{ ...base, conformeSignedAt: "2026-10-03", portalActivatedAt: "2026-10-05" }, "Planning in Events"],
  ])("names the next step for %o", (inquiry, label) => {
    expect(inquiryNextStep(inquiry).label).toBe(label);
  });
});

describe("inquiry funnel", () => {
  const now = new Date("2026-11-21T04:00:00.000Z");

  it("says how long a new inquiry has waited, amber from two days and red from five", () => {
    expect(inquiryWaitingAge({ status: "new", createdAt: "2026-11-21T01:00:00.000Z" }, now)).toEqual({ label: "Today", tone: "fresh" });
    expect(inquiryWaitingAge({ status: "new", createdAt: "2026-11-18T01:00:00.000Z" }, now)).toEqual({ label: "3 days", tone: "stale" });
    expect(inquiryWaitingAge({ status: "new", createdAt: "2026-11-14T01:00:00.000Z" }, now)).toEqual({ label: "7 days", tone: "late" });
    expect(inquiryWaitingAge({ status: "accepted", createdAt: "2026-11-14T01:00:00.000Z" }, now)).toBeNull();
  });

  it("counts what is new, what waits for a signed conforme and what was signed this month", () => {
    expect(inquiryFunnel([
      { status: "new" },
      { status: "accepted", acceptedAt: "2026-11-02" },
      { status: "accepted", acceptedAt: "2026-11-01", conformeSignedAt: "2026-11-05T02:00:00.000Z" },
      { status: "accepted", acceptedAt: "2026-09-01", conformeSignedAt: "2026-09-05T02:00:00.000Z" },
      { status: "declined" },
    ], now)).toEqual({ toReview: 1, waitingForConforme: 1, signedThisMonth: 1 });
  });
});

describe("returning client", () => {
  it("counts the client's other inquiries by email or company and names their last accepted event", () => {
    const current = { id: "inq_new", email: "Ana@Ayala.test", companyName: "Ayala Corp" };
    const history = clientInquiryHistory(current, [
      { id: "inq_new", email: "ana@ayala.test", companyName: "Ayala Corp", status: "new", eventName: "Awards", eventDate: "2027-10-08" },
      { id: "a", email: "ana@ayala.test", companyName: "", status: "accepted", eventName: "Gala 2025", eventDate: "2025-12-01" },
      { id: "b", email: "ops@ayala.test", companyName: "Ayala Corp", status: "accepted", eventName: "Gala 2026", eventDate: "2026-12-07" },
      { id: "c", email: "ana@ayala.test", companyName: "", status: "declined", eventName: "Party", eventDate: "2024-01-01" },
      { id: "d", email: "x@other.test", companyName: "Other", status: "accepted", eventName: "Other", eventDate: "2026-01-01" },
    ]);
    expect(history).toEqual({ earlier: 3, accepted: 2, lastEventName: "Gala 2026" });
    expect(clientInquiryHistory(current, [])).toBeNull();
  });
});
