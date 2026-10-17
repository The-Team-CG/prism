import type { GameRuleCurrentRound, GameRuleDefinition } from '../../contracts/game-rule.port';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { configurationErrors, templateConfiguration } from './template-configuration';

function submissionRound(
  configuration: Readonly<Record<string, unknown>>,
  currentRound: GameRuleCurrentRound,
  action: PrismSubmitEventGameActionInput,
) {
  if (!('templateId' in action) || action.templateId !== 'split-the-room' || action.roundKey !== currentRound.key) {
    return null;
  }
  return templateConfiguration(configuration, 'split-the-room')?.rounds
    .find(({ key }) => key === currentRound.key) ?? null;
}

function validateTextResponse(round: NonNullable<ReturnType<typeof submissionRound>>, action: PrismSubmitEventGameActionInput): string[] {
  return action.actionKind === 'answer' && 'response' in action.payload
    && typeof action.payload.response === 'string'
    && action.payload.response.length <= round.maxResponseLength
    ? []
    : ['Response is longer than this prompt allows'];
}

function validateRoomVote(round: NonNullable<ReturnType<typeof submissionRound>>, action: PrismSubmitEventGameActionInput): string[] {
  return action.actionKind === 'vote' && 'option' in action.payload
    && typeof action.payload.option === 'string'
    && [round.leftLabel, round.rightLabel].includes(action.payload.option)
    ? []
    : ['Vote is not one of the configured choices'];
}

export const splitTheRoomRule: GameRuleDefinition = {
  templateId: 'split-the-room',
  validateConfiguration: (configuration) => configurationErrors(configuration, 'split-the-room'),
  getCurrentRound: ({ configuration, startedAt, now }) => {
    const parsed = templateConfiguration(configuration, 'split-the-room');
    if (!parsed) return null;
    const elapsed = Math.max(0, now.getTime() - startedAt.getTime());
    let elapsedBefore = 0;
    for (const [index, round] of parsed.rounds.entries()) {
      const durationMs = round.durationSeconds * 1000;
      if (elapsed < elapsedBefore + durationMs) {
        return {
          key: round.key,
          number: index + 1,
          total: parsed.rounds.length,
          prompt: round.prompt,
          deadlineAt: new Date(startedAt.getTime() + elapsedBefore + durationMs),
          participantData: {
            kind: 'split-the-room',
            options: [round.leftLabel, round.rightLabel],
            maxResponseLength: round.maxResponseLength,
          },
        } satisfies GameRuleCurrentRound;
      }
      elapsedBefore += durationMs;
    }
    return null;
  },
  validateSubmission: ({ configuration, currentRound, action }) => {
    const round = submissionRound(configuration, currentRound, action);
    if (!round) {
      return ['Response does not match the active Split the Room round'];
    }
    return action.actionKind === 'answer'
      ? validateTextResponse(round, action)
      : validateRoomVote(round, action);
  },
  scoreSubmission: () => ({ points: 0, isCorrect: false }),
};
