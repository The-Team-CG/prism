import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { PrismEventGameKind, PrismSubmitEventGameActionInput } from '@prism/types';
import { eventGameParticipantResultSchema } from '@prism/types';
import { GAME_RULES, type GameRuleRegistryPort } from '../contracts/game-rule.port';
import type { GameRuleCurrentRound } from '../contracts/game-rule.port';
import type { GameRuleScoreResult } from '../contracts/game-rule.port';

export interface EventGameScore {
  points: number;
  isCorrect: boolean;
  result?: ReturnType<typeof eventGameParticipantResultSchema.parse>;
}

function assertValidScoreOutcome(outcome: GameRuleScoreResult): void {
  if (!Number.isSafeInteger(outcome.points) || outcome.points < 0 || typeof outcome.isCorrect !== 'boolean') {
    throw new InternalServerErrorException('Game rule returned an invalid score');
  }
}

function parseParticipantResult(result: GameRuleScoreResult['result']): EventGameScore['result'] {
  if (result === undefined) return undefined;
  const parsed = eventGameParticipantResultSchema.safeParse(result);
  if (!parsed.success) throw new InternalServerErrorException('Game rule returned an invalid participant result');
  return parsed.data;
}

@Injectable()
export class GameScoringService {
  constructor(
    @Optional() @Inject(GAME_RULES)
    private readonly rules: GameRuleRegistryPort | undefined,
  ) {}

  score(input: {
    kind: PrismEventGameKind;
    configuration: Readonly<Record<string, unknown>>;
    action: PrismSubmitEventGameActionInput;
    currentRound?: GameRuleCurrentRound;
    submittedAt?: Date;
  }): EventGameScore {
    const rule = this.rules?.get(input.kind);
    if (!rule) {
      throw new ServiceUnavailableException('This game type is not ready to score');
    }

    const outcome = rule.scoreSubmission({
      configuration: input.configuration,
      submission: input.action.payload,
      ...(input.currentRound ? { currentRound: input.currentRound } : {}),
      ...(input.submittedAt ? { submittedAt: input.submittedAt } : {}),
    });
    if (!outcome) {
      throw new InternalServerErrorException('Game rule returned an invalid score');
    }
    assertValidScoreOutcome(outcome);
    const result = parseParticipantResult(outcome.result);
    return {
      points: outcome.points,
      isCorrect: outcome.isCorrect,
      ...(result ? { result } : {}),
    };
  }
}
