import { createHash } from 'node:crypto';
import type { GameRuleCurrentRound, GameRuleDefinition } from '../../contracts/game-rule.port';
import { configurationErrors, normalizeAnswer, templateConfiguration } from './template-configuration';

function teamFor(
  teams: readonly { id: string; label: string }[],
  participantKey?: string,
  assignedTeamId?: string | null,
): { id: string; label: string } | null {
  if (assignedTeamId) return teams.find(({ id }) => id === assignedTeamId) ?? null;
  if (!participantKey || teams.length === 0) return null;
  const digest = createHash('sha256').update(`family-feud-team:${participantKey}`).digest();
  return teams[digest.readUInt32BE(0) % teams.length] ?? null;
}

function answerPoints(
  configuration: Readonly<Record<string, unknown>>,
  roundKey: string | undefined,
  answer: unknown,
): number {
  if (typeof answer !== 'string' || !roundKey) return 0;
  const parsed = templateConfiguration(configuration, 'family-feud');
  const round = parsed?.rounds.find(({ key }) => key === roundKey);
  const submitted = normalizeAnswer(answer);
    const match = round?.answers.find(({ answer: expected }) => normalizeAnswer(expected) === submitted);
  return match?.points ?? 0;
}

export const familyFeudRule: GameRuleDefinition = {
  templateId: 'family-feud',
  validateConfiguration: (configuration) => configurationErrors(configuration, 'family-feud'),
  getCurrentRound: ({ configuration, startedAt, now, participantKey, teamId, teamLabel }) => {
    const parsed = templateConfiguration(configuration, 'family-feud');
    if (!parsed) return null;
    const elapsed = Math.max(0, now.getTime() - startedAt.getTime());
    let elapsedBefore = 0;
    for (const [index, round] of parsed.rounds.entries()) {
      const durationMs = round.durationSeconds * 1000;
      if (elapsed < elapsedBefore + durationMs) {
        const team = teamFor(parsed.teams, participantKey, teamId);
        return {
          key: round.key,
          number: index + 1,
          total: parsed.rounds.length,
          prompt: round.prompt,
          deadlineAt: new Date(startedAt.getTime() + elapsedBefore + durationMs),
          ...(team ? {
            participantData: { kind: 'family-feud' as const, teamLabel: team.label },
            teamAssignment: { teamId: team.id, teamLabel: teamLabel ?? team.label },
          } : {}),
        } satisfies GameRuleCurrentRound;
      }
      elapsedBefore += durationMs;
    }
    return null;
  },
  validateSubmission: ({ configuration, currentRound, action }) => {
    const parsed = templateConfiguration(configuration, 'family-feud');
    if (!parsed || !('templateId' in action) || action.templateId !== 'family-feud'
      || action.actionKind !== 'answer' || action.roundKey !== currentRound.key
      || !parsed.rounds.some(({ key }) => key === currentRound.key)) {
      return ['Answer does not match the active Family Feud round'];
    }
    return [];
  },
  scoreSubmission: ({ configuration, submission, currentRound }) => {
    const points = answerPoints(configuration, currentRound?.key, submission.answer);
    return { points, isCorrect: points > 0 };
  },
};
