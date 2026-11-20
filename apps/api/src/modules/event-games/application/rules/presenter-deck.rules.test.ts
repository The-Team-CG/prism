import { describe, expect, it } from 'vitest';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { presenterDeckRule, RESULTS_DISPLAY_SECONDS } from './presenter-deck.rules';

const startedAt = new Date('2026-11-19T10:00:00.000Z');
const at = (seconds: number) => new Date(startedAt.getTime() + seconds * 1000);

const deck = { configuration: { kind: 'presenter-deck', rounds: [
  { key: 'd1', type: 'choice', prompt: 'Tea or coffee?', options: ['Tea', 'Coffee'], durationSeconds: 30 },
  { key: 'd2', type: 'scale', prompt: 'Rate the venue', scaleMax: 5, durationSeconds: 30 },
  { key: 'd3', type: 'word-cloud', prompt: 'One word for today', maxResponseLength: 12, durationSeconds: 30 },
] } };

/** Each slide is a 30-second question followed by the results window. */
const SLIDE = 30 + RESULTS_DISPLAY_SECONDS;

const roundAt = (seconds: number) => presenterDeckRule.getCurrentRound({ configuration: deck, startedAt, now: at(seconds) })!;
const vote = (roundKey: string, option: string): PrismSubmitEventGameActionInput => ({ templateId: 'presenter-deck', roundKey, actionKind: 'vote', payload: { option } });
const answer = (roundKey: string, response: string): PrismSubmitEventGameActionInput => ({ templateId: 'presenter-deck', roundKey, actionKind: 'answer', payload: { response } });
const validate = (seconds: number, action: PrismSubmitEventGameActionInput) =>
  presenterDeckRule.validateSubmission({ configuration: deck, currentRound: roundAt(seconds), action });

describe('Presenter Deck rule', () => {
  it('runs the deck in order and sends each prompt type only the data its controls need', () => {
    expect(roundAt(1)).toMatchObject({ key: 'd1', number: 1, total: 3, prompt: 'Tea or coffee?', deadlineAt: at(30),
      resultsOpen: false, participantData: { kind: 'presenter-deck', roundType: 'choice', options: ['Tea', 'Coffee'] } });
    expect(roundAt(SLIDE + 1)).toMatchObject({ key: 'd2', number: 2, deadlineAt: at(SLIDE + 30), resultsOpen: false,
      participantData: { kind: 'presenter-deck', roundType: 'scale', scaleMax: 5 } });
    expect(roundAt(2 * SLIDE + 1)).toMatchObject({ key: 'd3', number: 3, deadlineAt: at(2 * SLIDE + 30), resultsOpen: false,
      participantData: { kind: 'presenter-deck', roundType: 'word-cloud', maxResponseLength: 12 } });
    expect(presenterDeckRule.validateConfiguration(deck)).toEqual([]);
    expect(presenterDeckRule.validateConfiguration({ configuration: { kind: 'presenter-deck', rounds: [] } })).not.toEqual([]);
  });

  it('shows each slide\'s results for a fixed window after its question closes, then moves on', () => {
    // The question window ends at the deadline; the same slide then stays up with its results open.
    expect(roundAt(30)).toMatchObject({ key: 'd1', number: 1, deadlineAt: at(30), resultsOpen: true });
    expect(roundAt(SLIDE - 1)).toMatchObject({ key: 'd1', number: 1, deadlineAt: at(30), resultsOpen: true });
    expect(roundAt(SLIDE)).toMatchObject({ key: 'd2', number: 2, resultsOpen: false });
    // The last slide shows its results too, and the deck ends once that window closes.
    expect(roundAt(3 * SLIDE - 1)).toMatchObject({ key: 'd3', number: 3, resultsOpen: true });
    expect(presenterDeckRule.getCurrentRound({ configuration: deck, startedAt, now: at(3 * SLIDE) })).toBeNull();
  });

  it('accepts answers during the question window and refuses them while results are shown', () => {
    expect(validate(29, vote('d1', 'Tea'))).toEqual([]);
    expect(validate(30, vote('d1', 'Tea'))).toEqual(['Voting is closed for this question']);
    expect(validate(SLIDE + 29, vote('d2', '4'))).toEqual([]);
    expect(validate(SLIDE + 30, vote('d2', '4'))).toEqual(['Voting is closed for this question']);
    expect(validate(2 * SLIDE + 1, answer('d3', 'Bright'))).toEqual([]);
    expect(validate(2 * SLIDE + 30, answer('d3', 'Bright'))).toEqual(['Voting is closed for this question']);
  });

  it('accepts a choice vote only for one of the round options', () => {
    expect(validate(1, vote('d1', 'Tea'))).toEqual([]);
    expect(validate(1, vote('d1', 'Milk'))).not.toEqual([]);
    expect(validate(1, answer('d1', 'Tea'))).not.toEqual([]);
  });

  it('accepts a scale vote only as a whole number from 1 to the round maximum', () => {
    expect(validate(SLIDE + 1, vote('d2', '1'))).toEqual([]);
    expect(validate(SLIDE + 1, vote('d2', '5'))).toEqual([]);
    for (const option of ['0', '6', '3.5', '03', '-1', 'Tea']) {
      expect(validate(SLIDE + 1, vote('d2', option))).not.toEqual([]);
    }
  });

  it('caps word-cloud answers at the round length and rejects actions for another round or game', () => {
    const words = 2 * SLIDE + 1;
    expect(validate(words, answer('d3', 'x'.repeat(12)))).toEqual([]);
    expect(validate(words, answer('d3', 'x'.repeat(13)))).not.toEqual([]);
    expect(validate(words, vote('d3', '3'))).not.toEqual([]);
    expect(validate(words, answer('d1', 'Inspiring'))).not.toEqual([]);
    expect(validate(words, { templateId: 'word-cloud', roundKey: 'd3', actionKind: 'answer', payload: { response: 'Inspiring' } })).not.toEqual([]);
  });

  it('never scores audience answers', () => {
    expect(presenterDeckRule.scoreSubmission({ configuration: deck, submission: { option: '5' } })).toEqual({ points: 0, isCorrect: false });
  });
});
