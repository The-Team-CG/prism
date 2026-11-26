import type { GameRuleDefinition } from '../../contracts/game-rule.port';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { configurationErrors, normalizeAnswer, templateConfiguration } from './template-configuration';
import { roundWithResultsWindow } from './results-window';

export const liveTriviaRule: GameRuleDefinition = {
  templateId: 'live-trivia',
  validateConfiguration: (configuration) => {
    const errors = configurationErrors(configuration, 'live-trivia');
    const parsed = templateConfiguration(configuration, 'live-trivia');
    if (errors.length > 0 || !parsed) return errors;
    // Scoring compares answers after normalizeAnswer, so two options that normalize alike (e.g. "Résumé" and "Resume")
    // would both be scored as the correct answer. Reject them at publish and session start.
    const collides = parsed.rounds.some((round) => new Set(round.options.map(normalizeAnswer)).size !== round.options.length);
    return collides ? ['Trivia options must stay distinct when accents and capitalization are ignored'] : [];
  },
  // Each question is followed by a results window that reveals the answer before the next question starts.
  getCurrentRound: ({ configuration, startedAt, now }) => {
    const parsed = templateConfiguration(configuration, 'live-trivia');
    const active = parsed ? roundWithResultsWindow(parsed.rounds, startedAt, now) : null;
    if (!active) return null;
    return {
      key: active.round.key,
      prompt: active.round.prompt,
      ...active.timing,
      participantData: { kind: 'live-trivia', options: active.round.options },
    };
  },
  validateSubmission: ({ configuration, currentRound, action }) => {
    if (currentRound.resultsOpen) return ['Answers are closed for this question'];
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
