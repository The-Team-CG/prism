import { randomInt } from 'node:crypto';
import type { GameRuleDefinition } from '../../contracts/game-rule.port';
import { configurationErrors, templateConfiguration } from './template-configuration';

export function createSpinWheelRule(selectRandomIndex: (maxExclusive: number) => number = randomInt): GameRuleDefinition {
  return {
    templateId: 'spin-wheel',
    validateConfiguration: (configuration) => configurationErrors(configuration, 'spin-wheel'),
    getCurrentRound: ({ configuration }) => {
      if (!templateConfiguration(configuration, 'spin-wheel')) return null;
      return {
        key: 'spin-1',
        number: 1,
        total: 1,
        prompt: 'Spin the wheel when the host has started the game.',
        deadlineAt: null,
      };
    },
    validateSubmission: () => ['Only the host can select a wheel outcome'],
    scoreSubmission: ({ configuration }) => {
      const parsed = templateConfiguration(configuration, 'spin-wheel');
      const eligible = parsed?.outcomes.filter((outcome) => outcome.eligible) ?? [];
      const totalWeight = eligible.reduce((total, outcome) => total + outcome.weight, 0);
      if (!eligible.length || totalWeight <= 0) return { points: 0, isCorrect: false };

      const rawIndex = selectRandomIndex(totalWeight);
      const selectedIndex = Number.isSafeInteger(rawIndex) ? Math.min(totalWeight - 1, Math.max(0, rawIndex)) : 0;
      let ticket = selectedIndex;
      const selected = eligible.find((outcome) => {
        ticket -= outcome.weight;
        return ticket < 0;
      }) ?? eligible[eligible.length - 1]!;
      return {
        points: selected.points,
        isCorrect: true,
        result: { kind: 'spin-wheel', outcomeId: selected.id, label: selected.label, points: selected.points },
      };
    },
  };
}

export const spinWheelRule = createSpinWheelRule();
