import type { GameRuleDefinition } from '../../contracts/game-rule.port';
import { configurationErrors, normalizeAnswer, templateConfiguration } from './template-configuration';

function stageIndexAt(stages: readonly { afterSeconds: number }[], elapsedMs: number): number {
  return stages.reduce((current, stage, index) => stage.afterSeconds * 1000 <= elapsedMs ? index : current, 0);
}

export const guessPictureRule: GameRuleDefinition = {
  templateId: 'guess-picture',
  validateConfiguration: (configuration) => {
    const parsed = templateConfiguration(configuration, 'guess-picture');
    if (!parsed) return configurationErrors(configuration, 'guess-picture');
    const mediaObjectIds = configuration.mediaObjectIds;
    return Array.isArray(mediaObjectIds) && mediaObjectIds.includes(parsed.mediaObjectId)
      ? []
      : ['Picture media must be linked to the event game'];
  },
  getCurrentRound: ({ configuration, startedAt, now }) => {
    const parsed = templateConfiguration(configuration, 'guess-picture');
    if (!parsed) return null;
    const stageIndex = stageIndexAt(parsed.stages, Math.max(0, now.getTime() - startedAt.getTime()));
    const stage = parsed.stages[stageIndex];
    if (!stage) return null;
    return {
      key: 'picture-1',
      number: stageIndex + 1,
      total: parsed.stages.length,
      prompt: stage.hint,
      deadlineAt: null,
      participantData: { kind: 'guess-picture', mediaObjectId: parsed.mediaObjectId, stage: stageIndex + 1 },
    };
  },
  validateSubmission: ({ configuration, currentRound, action }) => {
    const parsed = templateConfiguration(configuration, 'guess-picture');
    if (!parsed || !('templateId' in action) || action.templateId !== 'guess-picture'
      || action.actionKind !== 'guess' || action.roundKey !== currentRound.key
      || !parsed.acceptedAnswers.some((answer) => normalizeAnswer(answer) === normalizeAnswer(action.payload.answer))) {
      return ['Picture guess does not match an accepted answer'];
    }
    return [];
  },
  scoreSubmission: ({ configuration, submission, currentRound }) => {
    const parsed = templateConfiguration(configuration, 'guess-picture');
    const answer = typeof submission.answer === 'string' ? normalizeAnswer(submission.answer) : '';
    const isCorrect = Boolean(parsed && parsed.acceptedAnswers.some((candidate) => normalizeAnswer(candidate) === answer));
    const stagePoints = parsed?.stages[(currentRound?.number ?? 0) - 1]?.points ?? 0;
    return { points: isCorrect ? stagePoints : 0, isCorrect };
  },
};
