import type { GameRuleDefinition, GameRuleCurrentRound } from '../../contracts/game-rule.port';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { configurationErrors, normalizeAnswer, templateConfiguration } from './template-configuration';

export const guessPictureSoloRule: GameRuleDefinition = {
  templateId: 'guess-picture-solo',
  validateConfiguration: (configuration) => {
    const parsed = templateConfiguration(configuration, 'guess-picture-solo');
    if (!parsed) return configurationErrors(configuration, 'guess-picture-solo');
    const mediaObjectIds = configuration.mediaObjectIds;
    return Array.isArray(mediaObjectIds) && parsed.rounds.every(({ mediaObjectId }) => mediaObjectIds.includes(mediaObjectId))
      ? []
      : ['Picture media must be linked to the event game'];
  },
  getCurrentRound: ({ configuration, startedAt, now }) => {
    const parsed = templateConfiguration(configuration, 'guess-picture-solo');
    if (!parsed) return null;
    const elapsed = Math.max(0, now.getTime() - startedAt.getTime());
    let elapsedBefore = 0;
    for (const [index, round] of parsed.rounds.entries()) {
      const durationMs = round.durationSeconds * 1000;
      if (elapsed < elapsedBefore + durationMs) {
        const elapsedInRound = elapsed - elapsedBefore;
        const stageIndex = round.stages.reduce((current, stage, stageIndex) =>
          stage.afterSeconds * 1000 <= elapsedInRound ? stageIndex : current, 0);
        const stage = round.stages[stageIndex];
        if (!stage) return null;
        return {
          key: round.key,
          number: index + 1,
          total: parsed.rounds.length,
          prompt: stage.hint,
          deadlineAt: new Date(startedAt.getTime() + elapsedBefore + durationMs),
          participantData: {
            kind: 'guess-picture-solo', mediaObjectId: round.mediaObjectId, stage: stageIndex + 1, totalStages: round.stages.length,
          },
        } satisfies GameRuleCurrentRound;
      }
      elapsedBefore += durationMs;
    }
    return null;
  },
  validateSubmission: ({ configuration, currentRound, action }) => {
    const parsed = templateConfiguration(configuration, 'guess-picture-solo');
    if (!parsed || !isGuessPictureSoloAction(action) || action.roundKey !== currentRound.key
      || !parsed.rounds.some(({ key }) => key === currentRound.key)) {
      return ['Picture guess does not match the active solo round'];
    }
    return [];
  },
  scoreSubmission: ({ configuration, submission, currentRound }) => {
    const parsed = templateConfiguration(configuration, 'guess-picture-solo');
    const round = parsed?.rounds.find(({ key }) => key === currentRound?.key);
    const answer = typeof submission.answer === 'string' ? normalizeAnswer(submission.answer) : '';
    const isCorrect = Boolean(round && round.acceptedAnswers.some((candidate) => normalizeAnswer(candidate) === answer));
    const stageIndex = currentRound?.participantData?.kind === 'guess-picture-solo'
      ? currentRound.participantData.stage - 1
      : -1;
    return { points: isCorrect ? round?.stages[stageIndex]?.points ?? 0 : 0, isCorrect };
  },
};

function isGuessPictureSoloAction(action: PrismSubmitEventGameActionInput): action is Extract<
  PrismSubmitEventGameActionInput,
  { templateId: 'guess-picture-solo' }
> {
  return 'templateId' in action && action.templateId === 'guess-picture-solo' && action.actionKind === 'answer';
}
