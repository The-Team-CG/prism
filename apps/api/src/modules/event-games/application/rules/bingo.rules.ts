import { createHash } from 'node:crypto';
import type { GameRuleCurrentRound, GameRuleDefinition } from '../../contracts/game-rule.port';
import { configurationErrors, templateConfiguration } from './template-configuration';

type BingoCell = number | 'FREE';

function cardFor(numbers: readonly number[], participantKey: string): BingoCell[] {
  const selected: BingoCell[] = numbers
    .map((number) => ({
      number,
      rank: createHash('sha256').update(`${participantKey}:bingo-card:${number}`).digest('hex'),
    }))
    .sort((left, right) => left.rank.localeCompare(right.rank))
    .slice(0, 24)
    .map(({ number }) => number);
  selected.splice(12, 0, 'FREE');
  return selected;
}

function hasWinningPattern(
  card: readonly BingoCell[],
  markedNumbers: readonly number[],
  winPattern: 'line' | 'full-card',
): boolean {
  const marked = new Set<BingoCell>([...markedNumbers, 'FREE']);
  if (winPattern === 'full-card') return card.every((cell) => marked.has(cell));
  const lines: number[][] = [];
  for (let row = 0; row < 5; row += 1) lines.push(Array.from({ length: 5 }, (_, column) => row * 5 + column));
  for (let column = 0; column < 5; column += 1) lines.push(Array.from({ length: 5 }, (_, row) => row * 5 + column));
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return lines.some((line) => line.every((index) => marked.has(card[index]!)));
}

function isBingoClaim(
  configuration: Readonly<Record<string, unknown>>,
  currentRound: GameRuleCurrentRound,
  submission: Readonly<Record<string, unknown>>,
): boolean {
  const parsed = templateConfiguration(configuration, 'bingo');
  const data = currentRound.participantData;
  if (!parsed || data?.kind !== 'bingo' || !Array.isArray(submission.markedNumbers)
    || submission.claim !== 'bingo') return false;
  const markedNumbers = submission.markedNumbers;
  if (!markedNumbers.every((number) => typeof number === 'number' && Number.isInteger(number))) return false;
  if (new Set(markedNumbers).size !== markedNumbers.length) return false;
  const card = data.card;
  const cardNumbers = new Set(card.filter((cell): cell is number => typeof cell === 'number'));
  const called = new Set(data.calledNumbers);
  if (!markedNumbers.every((number) => cardNumbers.has(number) && called.has(number))) return false;
  return hasWinningPattern(card, markedNumbers, parsed.winPattern);
}

export const bingoRule: GameRuleDefinition = {
  templateId: 'bingo',
  validateConfiguration: (configuration) => configurationErrors(configuration, 'bingo'),
  getCurrentRound: ({ configuration, startedAt, now, participantKey }) => {
    const parsed = templateConfiguration(configuration, 'bingo');
    if (!parsed) return null;
    const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1000));
    const callCount = Math.min(parsed.callSequence.length, Math.floor(elapsedSeconds / parsed.callIntervalSeconds) + 1);
    const calledNumbers = parsed.callSequence.slice(0, callCount);
    const participantData = participantKey
      ? { kind: 'bingo' as const, card: cardFor(parsed.callSequence, participantKey), calledNumbers }
      : undefined;
    const latestCall = calledNumbers[calledNumbers.length - 1];
    return {
      key: 'bingo-claim',
      number: callCount,
      total: parsed.callSequence.length,
      prompt: latestCall === undefined ? 'The host will start calling numbers soon.' : `Number called: ${latestCall}`,
      deadlineAt: null,
      ...(participantData ? { participantData } : {}),
    };
  },
  validateSubmission: ({ configuration, currentRound, action }) => {
    if (!('templateId' in action) || action.templateId !== 'bingo' || action.actionKind !== 'mark'
      || action.roundKey !== currentRound.key || !isBingoClaim(configuration, currentRound, action.payload)) {
      return ['Bingo claim is not a verified configured win'];
    }
    return [];
  },
  scoreSubmission: ({ configuration, submission, currentRound }) => {
    const parsed = templateConfiguration(configuration, 'bingo');
    const isCorrect = Boolean(parsed && isBingoClaim(configuration, currentRound!, submission));
    return { points: isCorrect && parsed ? parsed.points : 0, isCorrect };
  },
};
