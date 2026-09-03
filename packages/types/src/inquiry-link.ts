export const PUBLIC_INQUIRY_LINK_SOURCE = "Colleague or Friend";
export const PUBLIC_INQUIRY_LINK_CHANNEL = "pmcm-inquiry-link";

export function buildPublicInquiryLink(origin: string): string {
  const base = origin.trim().replace(/\/+$/, "") || "http://localhost:3001";
  const url = new URL("/inquiry", `${base}/`);
  url.searchParams.set("source", PUBLIC_INQUIRY_LINK_SOURCE);
  url.searchParams.set("channel", PUBLIC_INQUIRY_LINK_CHANNEL);
  return url.toString();
}

export function inquiryPrefillFromSearchParams(params: {
  get(name: string): string | null;
}): { source?: string; channel?: string } {
  const source = params.get("source")?.trim();
  const channel = params.get("channel")?.trim();
  return {
    ...(source ? { source } : {}),
    ...(channel ? { channel } : {}),
  };
}
