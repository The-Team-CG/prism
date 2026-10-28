import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  read: vi.fn(),
  submit: vi.fn(),
  revise: vi.fn(),
}));

vi.mock("../data/supplier-quote-link-repository", () => ({ supplierQuoteLinkRepository: repository }));

import { loadSupplierQuoteLink } from "./load-supplier-quote-link";
import { saveSupplierQuote } from "./save-supplier-quote";

const quoteInput = { amount: 25000, inclusions: ["Crew"], paymentTerms: "Net 15", notes: "" };

describe("supplier quote link actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("surfaces an unavailable or expired token instead of creating a quote", async () => {
    repository.read.mockRejectedValueOnce(new Error("Quote request not found"));
    await expect(loadSupplierQuoteLink("expired-token")).rejects.toThrow("Quote request not found");
    expect(repository.submit).not.toHaveBeenCalled();
  });

  it("validates an amount before sending a write", () => {
    expect(() => saveSupplierQuote("token", false, { ...quoteInput, amount: 0 })).toThrow("greater than zero");
    expect(repository.submit).not.toHaveBeenCalled();
    expect(repository.revise).not.toHaveBeenCalled();
  });

  it("submits a first quote and revises when a quote already exists", async () => {
    repository.submit.mockResolvedValueOnce({ id: "quote_new" });
    repository.revise.mockResolvedValueOnce({ id: "quote_revision" });
    await saveSupplierQuote("token-new", false, quoteInput);
    await saveSupplierQuote("token-existing", true, quoteInput);
    expect(repository.submit).toHaveBeenCalledWith("token-new", quoteInput);
    expect(repository.revise).toHaveBeenCalledWith("token-existing", quoteInput);
  });
});
