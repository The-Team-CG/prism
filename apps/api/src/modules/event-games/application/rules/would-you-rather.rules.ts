import type { GameRuleDefinition } from '../../contracts/game-rule.port';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { configurationErrors, templateConfiguration } from './template-configuration';

export const wouldYouRatherRule: GameRuleDefinition = {
  templateId: 'would-you-rather',
  validateConfiguration: (configuration) => configurationErrors(configuration, 'would-you-rather'),
  getCurrentRound: ({ configuration, startedAt, now }) => {
    const parsed = templateConfiguration(configuration, 'would-you-rather');
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
          participantData: { kind: 'would-you-rather', options: round.options, aggregateResults: round.aggregateResults },
        };
      }
      elapsedBefore += durationMs;
    }
    return null;
  },
  validateSubmission: ({ configuration, currentRound, action }) => {
    const round = templateConfiguration(configuration, 'would-you-rather')?.rounds
      .find(({ key }) => key === currentRound.key);
    if (!round || !isWouldYouRatherAction(action) || action.roundKey !== currentRound.key) {
      return ['Would You Rather response does not match the active round'];
    }
    if (action.actionKind !== (round.aggregateResults ? 'vote' : 'complete') || !round.options.includes(action.payload.option)) {
      return ['Choose one of the configured Would You Rather options'];
    }
    return [];
  },
  scoreSubmission: ({ submission }) => ({
    points: 0,
    isCorrect: false,
    result: { kind: 'singleplayer-choice', option: typeof submission.option === 'string' ? submission.option : '' },
  }),
};

function isWouldYouRatherAction(action: PrismSubmitEventGameActionInput): action is Extract<
  PrismSubmitEventGameActionInput,
  { templateId: 'would-you-rather' }
> {
  return 'templateId' in action && action.templateId === 'would-you-rather';
}
