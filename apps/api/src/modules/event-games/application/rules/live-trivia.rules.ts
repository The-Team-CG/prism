import type { GameRuleDefinition, GameRuleCurrentRound } from '../../contracts/game-rule.port';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { configurationErrors, normalizeAnswer, templateConfiguration } from './template-configuration';

function roundFor(currentRound: GameRuleCurrentRound | undefined, key: string) {
  if (!currentRound || currentRound.key !== key) return null;
  return currentRound;
}

export const liveTriviaRule: GameRuleDefinition = {
  templateId: 'live-trivia',
  validateConfiguration: (configuration) => configurationErrors(configuration, 'live-trivia'),
  getCurrentRound: ({ configuration, startedAt, now }) => {
    const parsed = templateConfiguration(configuration, 'live-trivia');
    if (!parsed) return null;
    const elapsed = Math.max(0, now.getTime() - startedAt.getTime());
    let elapsedBefore = 0;
    for (const [index, round] of parsed.rounds.entries()) {
      const durationMs = round.durationSeconds * 1000;
      const deadlineAt = new Date(startedAt.getTime() + elapsedBefore + durationMs);
      if (elapsed < elapsedBefore + durationMs) {
        return {
          key: round.key,
          number: index + 1,
          total: parsed.rounds.length,
          prompt: round.prompt,
          deadlineAt,
          participantData: { kind: 'live-trivia', options: round.options },
        };
      }
      elapsedBefore += durationMs;
    }
    return null;
  },
  validateSubmission: ({ configuration, currentRound, action }) => {
    const parsed = templateConfiguration(configuration, 'live-trivia');
    if (!parsed || !('templateId' in action) || action.templateId !== 'live-trivia'
      || action.actionKind !== 'answer' || action.roundKey !== currentRound.key) {
      return ['Trivia response does not match the active round'];
    }
    const round = parsed.rounds.find(({ key }) => key === currentRound.key);
    if (!round || !round.options.includes(action.payload.answer)) return ['Trivia answer is not configured'];
    return [];
  },
  scoreSubmission: ({ configuration, submission, currentRound, submittedAt }) => {
    const parsed = templateConfiguration(configuration, 'live-trivia');
    const round = parsed?.rounds.find(({ key }) => key === currentRound?.key);
    const answer = typeof submission.answer === 'string' ? submission.answer : '';
    const isCorrect = Boolean(round && normalizeAnswer(answer) === normalizeAnswer(round.correctAnswer));
    if (!round || !isCorrect) return { points: 0, isCorrect: false };

    const durationMs = round.durationSeconds * 1000;
    const remainingMs = currentRound?.deadlineAt && submittedAt
      ? Math.max(0, Math.min(durationMs, currentRound.deadlineAt.getTime() - submittedAt.getTime()))
      : 0;
    const speedBonus = round.speedBonusPoints
      ? Math.floor(round.speedBonusPoints * remainingMs / durationMs)
      : 0;
    return { points: round.points + speedBonus, isCorrect: true };
  },
};

export function isTriviaAction(action: PrismSubmitEventGameActionInput): boolean {
  return 'templateId' in action && action.templateId === 'live-trivia';
}
