import type { GameRuleDefinition, GameRuleCurrentRound } from '../../contracts/game-rule.port';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { configurationErrors, normalizeAnswer, templateConfiguration } from './template-configuration';

export const wordScrambleRule: GameRuleDefinition = {
  templateId: 'word-scramble',
  validateConfiguration: (configuration) => configurationErrors(configuration, 'word-scramble'),
  getCurrentRound: ({ configuration, startedAt, now }) => {
    const parsed = templateConfiguration(configuration, 'word-scramble');
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
          prompt: round.scrambledWord,
          deadlineAt: new Date(startedAt.getTime() + elapsedBefore + durationMs),
          participantData: { kind: 'word-scramble' },
        } satisfies GameRuleCurrentRound;
      }
      elapsedBefore += durationMs;
    }
    return null;
  },
  validateSubmission: ({ configuration, currentRound, action }) => {
    const parsed = templateConfiguration(configuration, 'word-scramble');
    if (!parsed || !isWordScrambleAction(action) || action.roundKey !== currentRound.key
      || !parsed.rounds.some(({ key }) => key === currentRound.key)) {
      return ['Word Scramble answer does not match the active round'];
    }
    return [];
  },
  scoreSubmission: ({ configuration, submission, currentRound }) => {
    const parsed = templateConfiguration(configuration, 'word-scramble');
    const round = parsed?.rounds.find(({ key }) => key === currentRound?.key);
    const answer = typeof submission.answer === 'string' ? submission.answer : '';
    const isCorrect = Boolean(round && normalizeAnswer(answer) === normalizeAnswer(round.answer));
    return { points: isCorrect && round ? round.points : 0, isCorrect };
  },
};

function isWordScrambleAction(action: PrismSubmitEventGameActionInput): action is Extract<
  PrismSubmitEventGameActionInput,
  { templateId: 'word-scramble' }
> {
  return 'templateId' in action && action.templateId === 'word-scramble' && action.actionKind === 'answer';
}
