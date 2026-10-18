import type { PrismHandoffBrief } from "@prism/types";
import { handoffBriefRepository } from "../data/handoff-brief-repository";

export function loadHandoffBrief(eventId: string): Promise<PrismHandoffBrief> {
  return handoffBriefRepository.get(eventId);
}
