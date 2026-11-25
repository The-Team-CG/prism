/**
 * The colour and letter each answer position keeps on every screen, so a guest can match the tile on their phone
 * to the one on the room screen at a glance. Colours come from the Prism brand palette and all carry white text.
 */
export interface GameChoiceTone {
  letter: string;
  /** Solid fill for the tile. */
  fill: string;
  /** Ring colour used to mark a guest's own choice. */
  ring: string;
}

const TONES: readonly GameChoiceTone[] = [
  { letter: "A", fill: "bg-[var(--prism-magenta)]", ring: "ring-[var(--prism-magenta)]" },
  { letter: "B", fill: "bg-[var(--prism-info)]", ring: "ring-[var(--prism-info)]" },
  { letter: "C", fill: "bg-[var(--prism-orange-deep)]", ring: "ring-[var(--prism-orange-deep)]" },
  { letter: "D", fill: "bg-[var(--prism-teal)]", ring: "ring-[var(--prism-teal)]" },
  { letter: "E", fill: "bg-[var(--prism-ink-soft)]", ring: "ring-[var(--prism-ink-soft)]" },
  { letter: "F", fill: "bg-[var(--prism-magenta-deep)]", ring: "ring-[var(--prism-magenta-deep)]" },
];

export function gameChoiceTone(index: number): GameChoiceTone {
  return TONES[((index % TONES.length) + TONES.length) % TONES.length]!;
}

/** Raw colour values for SVG drawing (the prize wheel), in the same order as the tiles. */
export const GAME_CHOICE_COLOURS: readonly string[] = [
  "var(--prism-magenta)", "var(--prism-info)", "var(--prism-orange-deep)",
  "var(--prism-teal)", "var(--prism-ink-soft)", "var(--prism-magenta-deep)",
];
