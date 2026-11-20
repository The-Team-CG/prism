import {
  eventGameTemplateConfigurationSchema,
  type PrismEventGameKind,
  type PrismEventGameTemplateConfiguration,
} from '@prism/types';
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
  /** The current round's results window is open (Presenter Deck only). */
  resultsOpen?: boolean | undefined;
};

/** Presenter Deck results show while the host pauses or during each slide's timed results window. */
export function presenterDeckResultsVisible(status: string, resultsOpen: boolean | undefined): boolean {
  return status === 'paused' || (status === 'live' && resultsOpen === true);
}

function isAggregateVisible(input: AggregateInput): boolean {
  if (input.kind === 'would-you-rather') return Boolean(configuredVoteOptions(input));
  if (input.kind === 'presenter-deck') return presenterDeckResultsVisible(input.status, input.resultsOpen);
  return input.kind === 'this-or-that'
    || input.kind === 'this-or-that-solo'
    || ((input.kind === 'split-the-room' || input.kind === 'live-poll') && input.status === 'paused');
}

type TemplateConfigurationOf<K extends PrismEventGameTemplateConfiguration['kind']> =
  Extract<PrismEventGameTemplateConfiguration, { kind: K }>;
type VoteOptionReader<C> = (configuration: C, roundKey: string) => readonly string[] | null;

function thisOrThatOptions(
  configuration: TemplateConfigurationOf<'this-or-that' | 'this-or-that-solo'>,
  roundKey: string,
): readonly string[] | null {
  const rounds: ReadonlyArray<{ key: string; options: readonly string[] }> = configuration.rounds;
  return rounds.find(({ key }) => key === roundKey)?.options ?? null;
}

function splitTheRoomOptions(configuration: TemplateConfigurationOf<'split-the-room'>, roundKey: string): readonly string[] | null {
  const round = configuration.rounds.find(({ key }) => key === roundKey);
  return round ? [round.leftLabel, round.rightLabel] : null;
}

function wouldYouRatherOptions(configuration: TemplateConfigurationOf<'would-you-rather'>, roundKey: string): readonly string[] | null {
  const round = configuration.rounds.find(({ key }) => key === roundKey);
  return round?.aggregateResults ? round.options : null;
}

function presenterDeckOptions(configuration: TemplateConfigurationOf<'presenter-deck'>, roundKey: string): readonly string[] | null {
  // Word-cloud prompts have no vote buckets; their approved answers come from moderation.
  const round = configuration.rounds.find(({ key }) => key === roundKey);
  if (round?.type === 'choice') return round.options;
  if (round?.type === 'scale') return Array.from({ length: round.scaleMax }, (_, index) => String(index + 1));
  return null;
}

/** Kinds whose rounds carry configured vote buckets; every other kind has none. */
const VOTE_OPTION_READERS: Partial<{
  [K in PrismEventGameTemplateConfiguration['kind']]: VoteOptionReader<TemplateConfigurationOf<K>>;
}> = {
  'this-or-that': thisOrThatOptions,
  'this-or-that-solo': thisOrThatOptions,
  'split-the-room': splitTheRoomOptions,
  'would-you-rather': wouldYouRatherOptions,
  'presenter-deck': presenterDeckOptions,
};

function configuredVoteOptions(input: AggregateInput): readonly string[] | null {
  const parsed = eventGameTemplateConfigurationSchema.safeParse(input.configSnapshot.configuration);
  if (!parsed.success || !input.roundKey || parsed.data.kind !== input.kind) return null;
  // The lookup is keyed by kind, so each reader always receives its own configuration shape.
  const read = VOTE_OPTION_READERS[parsed.data.kind] as VoteOptionReader<PrismEventGameTemplateConfiguration> | undefined;
  return read ? read(parsed.data, input.roundKey) : null;
}

function livePollOptions(input: AggregateInput): readonly string[] | null {
  const parsed = eventGameTemplateConfigurationSchema.safeParse(input.configSnapshot.configuration);
  if (!parsed.success || parsed.data.kind !== 'live-poll') return null;
  return parsed.data.rounds.find(({ key }) => key === input.roundKey)?.options ?? null;
}

export async function readConfiguredVoteAggregate(input: AggregateInput): Promise<Array<{ label: string; count: number }>> {
  if (!input.roundKey || !isAggregateVisible(input)) return [];
  const options = input.kind === 'live-poll' ? livePollOptions(input) : configuredVoteOptions(input);
  if (!options) return [];
  const rows = await input.actionStore.getRoundVoteCounts({
    eventId: input.eventId,
    sessionId: input.sessionId,
    roundKey: input.roundKey,
  }, input.transaction);
  const counts = new Map(rows.map(({ label, count }) => [label, count]));
  return options.map((label) => ({ label, count: counts.get(label) ?? 0 }));
}
