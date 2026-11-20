import type { GameRuleCurrentRound, GameRuleDefinition } from '../../contracts/game-rule.port';
import type { PrismEventGameTemplateConfiguration, PrismSubmitEventGameActionInput } from '@prism/types';
import { configurationErrors, templateConfiguration } from './template-configuration';

/** Presenter Deck: a timed deck of choice, rating-scale and word-cloud prompts the room answers. None is scored. */
type PresenterDeckRound = Extract<PrismEventGameTemplateConfiguration, { kind: 'presenter-deck' }>['rounds'][number];

const WHOLE_NUMBER = /^[1-9]\d*$/;

/** Seconds each slide's results stay on screen, after its question closes and before the next slide starts. */
export const RESULTS_DISPLAY_SECONDS = 10;
const RESULTS_DISPLAY_MS = RESULTS_DISPLAY_SECONDS * 1000;

function participantData(round: PresenterDeckRound): GameRuleCurrentRound['participantData'] {
  switch (round.type) {
    case 'choice': return { kind: 'presenter-deck', roundType: 'choice', options: round.options };
    case 'scale': return { kind: 'presenter-deck', roundType: 'scale', scaleMax: round.scaleMax };
    case 'word-cloud': return { kind: 'presenter-deck', roundType: 'word-cloud', maxResponseLength: round.maxResponseLength };
  }
}

function activeRound(configuration: Readonly<Record<string, unknown>>, startedAt: Date, now: Date): GameRuleCurrentRound | null {
  const parsed = templateConfiguration(configuration, 'presenter-deck');
  if (!parsed) return null;
  const elapsed = Math.max(0, now.getTime() - startedAt.getTime());
  let elapsedBefore = 0;
  for (const [index, round] of parsed.rounds.entries()) {
    // Each slide is its question window followed by a fixed results window.
    const questionMs = round.durationSeconds * 1000;
    const slideMs = questionMs + RESULTS_DISPLAY_MS;
    if (elapsed < elapsedBefore + slideMs) {
      return {
        key: round.key, number: index + 1, total: parsed.rounds.length, prompt: round.prompt,
        deadlineAt: new Date(startedAt.getTime() + elapsedBefore + questionMs),
        endsAt: new Date(startedAt.getTime() + elapsedBefore + slideMs),
        resultsOpen: elapsed >= elapsedBefore + questionMs,
        participantData: participantData(round),
      };
    }
    elapsedBefore += slideMs;
  }
  return null;
}

function roundFor(configuration: Readonly<Record<string, unknown>>, currentRound: GameRuleCurrentRound, action: PrismSubmitEventGameActionInput) {
  if (!('templateId' in action) || action.templateId !== 'presenter-deck' || action.roundKey !== currentRound.key) return null;
  return templateConfiguration(configuration, 'presenter-deck')?.rounds.find(({ key }) => key === currentRound.key) ?? null;
}

function validateDeckAction(round: PresenterDeckRound, action: PrismSubmitEventGameActionInput): string[] {
  const payload = action.payload as Record<string, unknown>;
  switch (round.type) {
    case 'choice':
      return action.actionKind === 'vote' && typeof payload.option === 'string' && round.options.includes(payload.option)
        ? [] : ['Vote is not one of the prompt options'];
    case 'scale':
      return action.actionKind === 'vote' && typeof payload.option === 'string' && WHOLE_NUMBER.test(payload.option)
        && Number(payload.option) <= round.scaleMax
        ? [] : [`Rating must be a whole number from 1 to ${round.scaleMax}`];
    case 'word-cloud':
      return action.actionKind === 'answer' && typeof payload.response === 'string' && payload.response.length <= round.maxResponseLength
        ? [] : ['Response is longer than this prompt allows'];
  }
}

export const presenterDeckRule: GameRuleDefinition = {
  templateId: 'presenter-deck',
  validateConfiguration: (configuration) => configurationErrors(configuration, 'presenter-deck'),
  getCurrentRound: ({ configuration, startedAt, now }) => activeRound(configuration, startedAt, now),
  validateSubmission: ({ configuration, currentRound, action }) => {
    if (currentRound.resultsOpen) return ['Voting is closed for this question'];
    const round = roundFor(configuration, currentRound, action);
    return round ? validateDeckAction(round, action) : ['Response does not match the active round'];
  },
  scoreSubmission: () => ({ points: 0, isCorrect: false }),
};
