export {
  createEventOpsClient,
  type CreatePrismInquiryInput,
  type EventOpsActorQuery,
  type EventOpsClient,
  type EventOpsClientOptions,
} from "./event-ops-client";
export {
  DEFAULT_PRISM_API_BASE_URL,
  PrismApiError,
  normalizePrismApiProblem,
  prismRequest,
  resolvePrismApiBaseUrl,
  toQueryString,
  type PrismRequestInit,
} from "./http";

import { prismRequest, type PrismRequestInit } from "./http";

export async function prismJson<T>(path: string, init?: PrismRequestInit): Promise<T> {
  return prismRequest<T>(path, init);
}
