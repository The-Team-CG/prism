import { describe, expect, it } from "vitest";
import {
  PUBLIC_INQUIRY_LINK_CHANNEL,
  PUBLIC_INQUIRY_LINK_SOURCE,
  buildPublicInquiryLink,
  inquiryPrefillFromSearchParams,
} from "./inquiry-link.js";

describe("public inquiry link", () => {
  it("builds a tagged public inquiry URL without sending email", () => {
    expect(buildPublicInquiryLink("http://localhost:3001")).toBe(
      "http://localhost:3001/inquiry?source=Colleague+or+Friend&channel=pmcm-inquiry-link",
    );
    expect(PUBLIC_INQUIRY_LINK_SOURCE).toBe("Colleague or Friend");
    expect(PUBLIC_INQUIRY_LINK_CHANNEL).toBe("pmcm-inquiry-link");
  });

  it("reads source and channel prefill from search params", () => {
    const params = new URLSearchParams("source=Colleague%20or%20Friend&channel=pmcm-inquiry-link");
    expect(inquiryPrefillFromSearchParams(params)).toEqual({
      source: "Colleague or Friend",
      channel: "pmcm-inquiry-link",
    });
    expect(inquiryPrefillFromSearchParams(new URLSearchParams())).toEqual({});
  });
});
