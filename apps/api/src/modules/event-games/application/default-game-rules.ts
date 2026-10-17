import { bingoRule } from './rules/bingo.rules';
import { guessPictureRule } from './rules/guess-picture.rules';
import { liveTriviaRule } from './rules/live-trivia.rules';
import { spinWheelRule } from './rules/spin-wheel.rules';
import { thisOrThatRule } from './rules/this-or-that.rules';
import { familyFeudRule } from './rules/family-feud.rules';
import { splitTheRoomRule } from './rules/split-the-room.rules';
import { wordScrambleRule } from './rules/word-scramble.rules';
import { guessPictureSoloRule } from './rules/guess-picture-solo.rules';
import { spotTheDifferenceRule } from './rules/spot-the-difference.rules';
import { wouldYouRatherRule } from './rules/would-you-rather.rules';
import { thisOrThatSoloRule } from './rules/this-or-that-solo.rules';
import { GameRuleRegistry } from './game-rule-registry';

export function createDefaultGameRuleRegistry(): GameRuleRegistry {
  const registry = new GameRuleRegistry();
  for (const rule of [
    liveTriviaRule,
    bingoRule,
    guessPictureRule,
    spinWheelRule,
    thisOrThatRule,
    familyFeudRule,
    splitTheRoomRule,
    wordScrambleRule,
    guessPictureSoloRule,
    spotTheDifferenceRule,
    wouldYouRatherRule,
    thisOrThatSoloRule,
  ]) {
    registry.register(rule);
  }
  return registry;
}
