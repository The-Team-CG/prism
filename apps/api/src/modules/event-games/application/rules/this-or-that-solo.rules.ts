import type { GameRuleDefinition } from '../../contracts/game-rule.port';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { configurationErrors, templateConfiguration } from './template-configuration';

export const thisOrThatSoloRule: GameRuleDefinition = {
  templateId: 'this-or-that-solo',
  validateConfiguration: (configuration) => configurationErrors(configuration, 'this-or-that-solo'),
  getCurrentRound: ({ configuration, startedAt, now }) => {
    const parsed = templateConfiguration(configuration, 'this-or-that-solo');
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
          participantData: { kind: 'this-or-that-solo', options: round.options },
        };
      }
      elapsedBefore += durationMs;
    }
    return null;
  },
  validateSubmission: ({ configuration, currentRound, action }) => {
    const round = templateConfiguration(configuration, 'this-or-that-solo')?.rounds
      .find(({ key }) => key === currentRound.key);
    if (!round || !isThisOrThatSoloAction(action) || action.roundKey !== currentRound.key
      || !round.options.includes(action.payload.option)) {
      return ['This or That (Solo) choice does not match the active round'];
    }
    return [];
  },
  scoreSubmission: ({ submission }) => ({
    points: 0,
    isCorrect: false,
    result: { kind: 'singleplayer-choice', option: typeof submission.option === 'string' ? submission.option : '' },
  }),
};

function isThisOrThatSoloAction(action: PrismSubmitEventGameActionInput): action is Extract<
  PrismSubmitEventGameActionInput,
  { templateId: 'this-or-that-solo' }
> {
  return 'templateId' in action && action.templateId === 'this-or-that-solo';
}
