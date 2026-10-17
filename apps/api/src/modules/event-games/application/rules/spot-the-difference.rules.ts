import type { GameRuleDefinition, GameRuleCurrentRound } from '../../contracts/game-rule.port';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { configurationErrors, templateConfiguration } from './template-configuration';

type Point = { x: number; y: number };
type Region = { x: number; y: number; width: number; height: number; points: number };

export const spotTheDifferenceRule: GameRuleDefinition = {
  templateId: 'spot-the-difference',
  validateConfiguration: (configuration) => {
    const parsed = templateConfiguration(configuration, 'spot-the-difference');
    if (!parsed) return configurationErrors(configuration, 'spot-the-difference');
    const mediaObjectIds = configuration.mediaObjectIds;
    const requiredIds = parsed.rounds.flatMap(({ originalMediaObjectId, comparisonMediaObjectId }) =>
      [originalMediaObjectId, comparisonMediaObjectId]);
    return Array.isArray(mediaObjectIds) && requiredIds.every((mediaObjectId) => mediaObjectIds.includes(mediaObjectId))
      ? []
      : ['Spot the Difference images must be linked to the event game'];
  },
  getCurrentRound: ({ configuration, startedAt, now }) => {
    const parsed = templateConfiguration(configuration, 'spot-the-difference');
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
          prompt: 'Select each visible difference in the comparison image.',
          deadlineAt: new Date(startedAt.getTime() + elapsedBefore + durationMs),
          participantData: {
            kind: 'spot-the-difference',
            originalMediaObjectId: round.originalMediaObjectId,
            comparisonMediaObjectId: round.comparisonMediaObjectId,
            totalDifferences: round.differences.length,
          },
        } satisfies GameRuleCurrentRound;
      }
      elapsedBefore += durationMs;
    }
    return null;
  },
  validateSubmission: ({ configuration, currentRound, action }) => {
    const parsed = templateConfiguration(configuration, 'spot-the-difference');
    const round = parsed?.rounds.find(({ key }) => key === currentRound.key);
    if (!round || !isSpotDifferenceAction(action) || action.roundKey !== currentRound.key
      || action.payload.selections.length > 12) {
      return ['Spot the Difference selection does not match the active round'];
    }
    return [];
  },
  scoreSubmission: ({ configuration, submission, currentRound }) => {
    const parsed = templateConfiguration(configuration, 'spot-the-difference');
    const round = parsed?.rounds.find(({ key }) => key === currentRound?.key);
    if (!round) return { points: 0, isCorrect: false };
    const selections = parseSelections(submission.selections);
    const found = round.differences.filter((region) => selections.some((point) => containsPoint(region, point)));
    return {
      points: found.reduce((sum, region) => sum + region.points, 0),
      isCorrect: found.length === round.differences.length,
    };
  },
};

function isSpotDifferenceAction(action: PrismSubmitEventGameActionInput): action is Extract<
  PrismSubmitEventGameActionInput,
  { templateId: 'spot-the-difference' }
> {
  return 'templateId' in action && action.templateId === 'spot-the-difference' && action.actionKind === 'select';
}

function parseSelections(value: unknown): Point[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseSelection).filter((selection): selection is Point => selection !== null);
}

function parseSelection(selection: unknown): Point | null {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return null;
  const { x, y } = selection as Record<string, unknown>;
  return isUnitCoordinate(x) && isUnitCoordinate(y) ? { x, y } : null;
}

function isUnitCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function containsPoint(region: Region, point: Point): boolean {
  return point.x >= region.x && point.x <= region.x + region.width
    && point.y >= region.y && point.y <= region.y + region.height;
}
