import type { GameRuleCurrentRound, GameRuleDefinition } from '../../contracts/game-rule.port';
import type { PrismEventGameTemplateConfiguration, PrismSubmitEventGameActionInput } from '@prism/types';
import { configurationErrors, templateConfiguration } from './template-configuration';

/** FR-40: Live Poll, Word Cloud and Open Q and A run as timed rounds the room answers. None is scored. */
type AudienceKind = 'live-poll' | 'word-cloud' | 'open-qa';
type AudienceRound = Extract<PrismEventGameTemplateConfiguration, { kind: AudienceKind }>['rounds'][number];

const OPEN_QA_MAX_LENGTH = 300;

function participantData(kind: AudienceKind, round: AudienceRound): GameRuleCurrentRound['participantData'] {
  if (kind === 'live-poll' && 'options' in round) return { kind, options: round.options };
  if (kind === 'word-cloud' && 'maxResponseLength' in round) return { kind, maxResponseLength: round.maxResponseLength };
  return { kind: 'open-qa', maxResponseLength: OPEN_QA_MAX_LENGTH };
}

function activeRound(kind: AudienceKind, configuration: Readonly<Record<string, unknown>>, startedAt: Date, now: Date): GameRuleCurrentRound | null {
  const parsed = templateConfiguration(configuration, kind);
  if (!parsed) return null;
  const rounds: readonly AudienceRound[] = parsed.rounds;
  const elapsed = Math.max(0, now.getTime() - startedAt.getTime());
  let elapsedBefore = 0;
  for (const [index, round] of rounds.entries()) {
    const durationMs = round.durationSeconds * 1000;
    if (elapsed < elapsedBefore + durationMs) {
      return {
        key: round.key, number: index + 1, total: rounds.length, prompt: round.prompt,
        deadlineAt: new Date(startedAt.getTime() + elapsedBefore + durationMs),
        participantData: participantData(kind, round),
      };
    }
    elapsedBefore += durationMs;
  }
  return null;
}

function roundFor(kind: AudienceKind, configuration: Readonly<Record<string, unknown>>, currentRound: GameRuleCurrentRound, action: PrismSubmitEventGameActionInput) {
  if (!('templateId' in action) || action.templateId !== kind || action.roundKey !== currentRound.key) return null;
  const rounds: readonly AudienceRound[] = templateConfiguration(configuration, kind)?.rounds ?? [];
  return rounds.find(({ key }) => key === currentRound.key) ?? null;
}

function validateAudienceAction(kind: AudienceKind, round: AudienceRound, action: PrismSubmitEventGameActionInput): string[] {
  const payload = action.payload as Record<string, unknown>;
  if (kind === 'live-poll') {
    return 'options' in round && typeof payload.option === 'string' && round.options.includes(payload.option) ? [] : ['Vote is not one of the poll options'];
  }
  const limit = 'maxResponseLength' in round ? round.maxResponseLength : OPEN_QA_MAX_LENGTH;
  return typeof payload.response === 'string' && payload.response.length <= limit ? [] : ['Response is longer than this prompt allows'];
}

function audienceRule(kind: AudienceKind): GameRuleDefinition {
  return {
    templateId: kind,
    validateConfiguration: (configuration) => configurationErrors(configuration, kind),
    getCurrentRound: ({ configuration, startedAt, now }) => activeRound(kind, configuration, startedAt, now),
    validateSubmission: ({ configuration, currentRound, action }) => {
      const round = roundFor(kind, configuration, currentRound, action);
      return round ? validateAudienceAction(kind, round, action) : ['Response does not match the active round'];
    },
    scoreSubmission: () => ({ points: 0, isCorrect: false }),
  };
}

export const livePollRule = audienceRule('live-poll');
export const wordCloudRule = audienceRule('word-cloud');
export const openQaRule = audienceRule('open-qa');
