import { describe, expect, it } from 'vitest';
import type { PrismSubmitEventGameActionInput } from '@prism/types';
import { livePollRule, openQaRule, wordCloudRule } from './audience-response.rules';

const startedAt = new Date('2026-10-17T10:00:00.000Z');
const at = (seconds: number) => new Date(startedAt.getTime() + seconds * 1000);

const poll = { configuration: { kind: 'live-poll', rounds: [
  { key: 'r1', prompt: 'Best session?', options: ['Keynote', 'Panel', 'Workshop'], durationSeconds: 30 },
  { key: 'r2', prompt: 'Lunch?', options: ['Yes', 'No'], durationSeconds: 30 },
] } };
const cloud = { configuration: { kind: 'word-cloud', rounds: [{ key: 'w1', prompt: 'One word for today', maxResponseLength: 20, durationSeconds: 60 }] } };
const qa = { configuration: { kind: 'open-qa', rounds: [{ key: 'q1', prompt: 'Ask the panel', durationSeconds: 600 }] } };

describe('FR-40 audience response games', () => {
  it('runs poll rounds in order and accepts only a configured option', () => {
    const round = livePollRule.getCurrentRound({ configuration: poll, startedAt, now: at(35) })!;
    expect(round).toMatchObject({ key: 'r2', number: 2, total: 2, participantData: { kind: 'live-poll', options: ['Yes', 'No'] } });
    const vote = (option: string): PrismSubmitEventGameActionInput => ({ templateId: 'live-poll', roundKey: 'r2', actionKind: 'vote', payload: { option } });
    expect(livePollRule.validateSubmission({ configuration: poll, currentRound: round, action: vote('Yes') })).toEqual([]);
    expect(livePollRule.validateSubmission({ configuration: poll, currentRound: round, action: vote('Keynote') })).not.toEqual([]);
    expect(livePollRule.getCurrentRound({ configuration: poll, startedAt, now: at(61) })).toBeNull();
  });

  it('caps word cloud and question length, and never scores audience answers', () => {
    const cloudRound = wordCloudRule.getCurrentRound({ configuration: cloud, startedAt, now: at(1) })!;
    const answer = (templateId: 'word-cloud' | 'open-qa', roundKey: string, response: string): PrismSubmitEventGameActionInput => ({ templateId, roundKey, actionKind: 'answer', payload: { response } });
    expect(wordCloudRule.validateSubmission({ configuration: cloud, currentRound: cloudRound, action: answer('word-cloud', 'w1', 'Inspiring') })).toEqual([]);
    expect(wordCloudRule.validateSubmission({ configuration: cloud, currentRound: cloudRound, action: answer('word-cloud', 'w1', 'x'.repeat(21)) })).not.toEqual([]);

    const qaRound = openQaRule.getCurrentRound({ configuration: qa, startedAt, now: at(1) })!;
    expect(qaRound.participantData).toEqual({ kind: 'open-qa', maxResponseLength: 300 });
    expect(openQaRule.validateSubmission({ configuration: qa, currentRound: qaRound, action: answer('open-qa', 'q1', 'How do you pick speakers?') })).toEqual([]);
    expect(openQaRule.validateSubmission({ configuration: qa, currentRound: qaRound, action: answer('word-cloud', 'q1', 'Wrong game') })).not.toEqual([]);
    expect(openQaRule.scoreSubmission({ configuration: qa, submission: { response: 'Q' } })).toEqual({ points: 0, isCorrect: false });
  });
});
