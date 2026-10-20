import { decisionLogQuerySchema, parseContract, type PrismDecisionLog, type PrismDecisionLogQueryInput } from "@prism/types";
import { decisionLogRepository } from "../data/decision-log-repository";

/** Validates the kind filter and paging with the shared contract before any request is sent. */
export function loadDecisionLog(eventId: string, filters: PrismDecisionLogQueryInput): Promise<PrismDecisionLog> {
  const query = parseContract(decisionLogQuerySchema, filters, "Decision log filters");
  return decisionLogRepository.load(eventId, query);
}
