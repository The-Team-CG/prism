import type { PrismCoordinatorInsightFacts } from '@prism/types';

export const COORDINATOR_INSIGHT_FACTS_READER = Symbol('COORDINATOR_INSIGHT_FACTS_READER');

export interface CoordinatorInsightFactsReader {
  getForEvent(eventId: string): Promise<PrismCoordinatorInsightFacts>;
}
