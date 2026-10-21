import type { GameRuleCurrentRound, GameRuleDefinition } from '../../contracts/game-rule.port';
import { configurationErrors, templateConfiguration } from './template-configuration';

export const thisOrThatRule: GameRuleDefinition = {
  templateId: 'this-or-that',
  validateConfiguration: (configuration) => configurationErrors(configuration, 'this-or-that'),
  getCurrentRound: ({ configuration, startedAt, now }) => {
    const parsed = templateConfiguration(configuration, 'this-or-that');
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
          participantData: { kind: 'this-or-that', options: round.options },
        } satisfies GameRuleCurrentRound;
      }
      elapsedBefore += durationMs;
    }
    return null;
  },
  validateSubmission: ({ configuration, currentRound, action }) => {
    const parsed = templateConfiguration(configuration, 'this-or-that');
    if (!parsed || !('templateId' in action) || action.templateId !== 'this-or-that'
      || action.actionKind !== 'vote' || action.roundKey !== currentRound.key) {
      return ['Vote does not match the active This or That round'];
    }
    const round = parsed.rounds.find(({ key }) => key === currentRound.key);
    return round?.options.includes(action.payload.option)
      ? []
      : ['Vote is not one of the configured options'];
  },
  scoreSubmission: () => ({ points: 0, isCorrect: false }),
};
