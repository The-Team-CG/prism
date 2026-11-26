import type { GameRuleCurrentRound, GameRuleDefinition } from '../../contracts/game-rule.port';
import type { PrismEventGameTemplateConfiguration, PrismSubmitEventGameActionInput } from '@prism/types';
import { configurationErrors, templateConfiguration } from './template-configuration';
import { roundWithResultsWindow } from './results-window';

/** Presenter Deck: a timed deck of choice, rating-scale and word-cloud prompts the room answers. None is scored. */
type PresenterDeckRound = Extract<PrismEventGameTemplateConfiguration, { kind: 'presenter-deck' }>['rounds'][number];

const WHOLE_NUMBER = /^[1-9]\d*$/;

export { RESULTS_DISPLAY_SECONDS } from './results-window';

function participantData(round: PresenterDeckRound): GameRuleCurrentRound['participantData'] {
  switch (round.type) {
    case 'choice': return { kind: 'presenter-deck', roundType: 'choice', options: round.options };
    case 'scale': return { kind: 'presenter-deck', roundType: 'scale', scaleMax: round.scaleMax };
    case 'word-cloud': return { kind: 'presenter-deck', roundType: 'word-cloud', maxResponseLength: round.maxResponseLength };
  }
}

function activeRound(configuration: Readonly<Record<string, unknown>>, startedAt: Date, now: Date): GameRuleCurrentRound | null {
  const parsed = templateConfiguration(configuration, 'presenter-deck');
  const active = parsed ? roundWithResultsWindow(parsed.rounds, startedAt, now) : null;
  if (!active) return null;
  return { key: active.round.key, prompt: active.round.prompt, ...active.timing, participantData: participantData(active.round) };
}

function roundFor(configuration: Readonly<Record<string, unknown>>, currentRound: GameRuleCurrentRound, action: PrismSubmitEventGameActionInput) {
  if (!('templateId' in action) || action.templateId !== 'presenter-deck' || action.roundKey !== currentRound.key) return null;
  return templateConfiguration(configuration, 'presenter-deck')?.rounds.find(({ key }) => key === currentRound.key) ?? null;
}

type DeckRoundOf<T extends PresenterDeckRound['type']> = Extract<PresenterDeckRound, { type: T }>;
type DeckActionValidator<R extends PresenterDeckRound> = (round: R, action: PrismSubmitEventGameActionInput) => string[];

function payloadOf(action: PrismSubmitEventGameActionInput): Record<string, unknown> {
  return action.payload as Record<string, unknown>;
}

function validateChoiceAction(round: DeckRoundOf<'choice'>, action: PrismSubmitEventGameActionInput): string[] {
  const payload = payloadOf(action);
  return action.actionKind === 'vote' && typeof payload.option === 'string' && round.options.includes(payload.option)
    ? [] : ['Vote is not one of the prompt options'];
}

function validateScaleAction(round: DeckRoundOf<'scale'>, action: PrismSubmitEventGameActionInput): string[] {
  const payload = payloadOf(action);
  return action.actionKind === 'vote' && typeof payload.option === 'string' && WHOLE_NUMBER.test(payload.option)
    && Number(payload.option) <= round.scaleMax
    ? [] : [`Rating must be a whole number from 1 to ${round.scaleMax}`];
}

function validateWordCloudAction(round: DeckRoundOf<'word-cloud'>, action: PrismSubmitEventGameActionInput): string[] {
  const payload = payloadOf(action);
  return action.actionKind === 'answer' && typeof payload.response === 'string' && payload.response.length <= round.maxResponseLength
    ? [] : ['Response is longer than this prompt allows'];
}

const DECK_ACTION_VALIDATORS: { [T in PresenterDeckRound['type']]: DeckActionValidator<DeckRoundOf<T>> } = {
  choice: validateChoiceAction,
  scale: validateScaleAction,
  'word-cloud': validateWordCloudAction,
};

function validateDeckAction(round: PresenterDeckRound, action: PrismSubmitEventGameActionInput): string[] {
  // The lookup is keyed by round.type, so the validator always receives its own round shape.
  const validate = DECK_ACTION_VALIDATORS[round.type] as DeckActionValidator<PresenterDeckRound>;
  return validate(round, action);
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
