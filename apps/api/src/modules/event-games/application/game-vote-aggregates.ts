import { eventGameTemplateConfigurationSchema, type PrismEventGameKind } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { GameActionStorePort } from '../contracts/game-action-store.port';

type AggregateInput = {
  actionStore: GameActionStorePort;
  transaction: PrismTransactionContext;
  eventId: string;
  sessionId: string;
  kind: PrismEventGameKind;
  configSnapshot: Readonly<Record<string, unknown>>;
  roundKey: string | null;
  status: string;
};

function isAggregateVisible(input: AggregateInput): boolean {
  if (input.kind === 'would-you-rather') return Boolean(configuredVoteOptions(input));
  return input.kind === 'this-or-that'
    || input.kind === 'this-or-that-solo'
    || (input.kind === 'split-the-room' && input.status === 'paused');
}

function configuredVoteOptions(input: AggregateInput): readonly string[] | null {
  const parsed = eventGameTemplateConfigurationSchema.safeParse(input.configSnapshot.configuration);
  if (!parsed.success || !input.roundKey || parsed.data.kind !== input.kind) return null;
  switch (parsed.data.kind) {
    case 'this-or-that':
    case 'this-or-that-solo':
      return parsed.data.rounds.find(({ key }) => key === input.roundKey)?.options ?? null;
    case 'split-the-room': {
      const round = parsed.data.rounds.find(({ key }) => key === input.roundKey);
      return round ? [round.leftLabel, round.rightLabel] : null;
    }
    case 'would-you-rather': {
      const round = parsed.data.rounds.find(({ key }) => key === input.roundKey);
      return round?.aggregateResults ? round.options : null;
    }
    default:
      return null;
  }
}

export async function readConfiguredVoteAggregate(input: AggregateInput): Promise<Array<{ label: string; count: number }>> {
  if (!input.roundKey || !isAggregateVisible(input)) return [];
  const options = configuredVoteOptions(input);
  if (!options) return [];
  const rows = await input.actionStore.getRoundVoteCounts({
    eventId: input.eventId,
    sessionId: input.sessionId,
    roundKey: input.roundKey,
  }, input.transaction);
  const counts = new Map(rows.map(({ label, count }) => [label, count]));
  return options.map((label) => ({ label, count: counts.get(label) ?? 0 }));
}
