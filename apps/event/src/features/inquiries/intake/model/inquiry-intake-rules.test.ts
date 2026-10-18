import { describe, expect, it } from "vitest";
import type { PrismInquiry } from "@prism/types";
import {
  canMergeInquiry,
  inquiryExtraDetailFields,
  inquiryHistoryCues,
  inquiryMatchesIntakeFilters,
  inquiryMergeCandidates,
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
      previouslyDeclined: true,
      previousDeclineReason: "Date conflict",
    } as never)).toEqual([
      { label: "Previously declined", value: "Yes" },
      { label: "Previous decline", value: "Date conflict" },
    ]);
  });

  it("requires a complete log form and trims optional fields", () => {
    expect(isInquiryLogFormReady(initialLogForm)).toBe(false);
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
