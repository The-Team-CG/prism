"use client";

import CloudLayout from "d3-cloud";
import { useEffect, useMemo, useState } from "react";
import { PresenterSection, wordCloudTerms } from "./presenter-blocks";

interface CloudWord {
  text: string;
  count: number;
  size: number;
  colour: string;
  rotate: number;
  x?: number;
  y?: number;
}

const COLOURS = ["#ffffff", "#f2b134", "#7fc8e8", "#ff8fb8", "#8fe0c8"];
const WIDTH = 1000;
const HEIGHT = 480;
const SLICE_MS = 12;

export function PresenterWordCloud({ responses, title = "Word cloud" }: { responses: readonly string[]; title?: string }) {
  // Polling supplies a fresh array each time. Keep the layout stable when its contents have not changed.
  const responseKey = JSON.stringify(responses);
  const terms = useMemo(() => wordCloudTerms(JSON.parse(responseKey)), [responseKey]);
  const [placed, setPlaced] = useState<CloudWord[] | null>(null);

  useEffect(() => {
    setPlaced(null);
    if (typeof ResizeObserver === "undefined") return;
    const max = Math.max(1, ...terms.map(({ count }) => count));
    const words: CloudWord[] = terms.map(({ text, count }, index) => ({
      text,
      count,
      size: Math.min(26 + 64 * Math.sqrt(count / max), 850 / Math.max(text.length * 0.58, 1)),
      colour: COLOURS[index % COLOURS.length],
      rotate: index > 2 && index % 5 === 0 && text.length <= 18 ? 90 : 0,
    }));
    // A fixed sequence keeps the cloud from jumping on identical refreshes.
    let seed = 42;
    const layout = new CloudLayout()
      .size([WIDTH, HEIGHT])
      .overflow(false)
      .random(() => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      });
    // Largest first, so the big words claim the middle. Placement is synchronous, so it works in short slices and
    // yields between them to keep the presenter screen responsive; a changed response list cancels the pass.
    const queue = [...words].sort((a, b) => b.size - a.size);
    const result: CloudWord[] = [];
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const step = () => {
      const sliceEnd = Date.now() + SLICE_MS;
      while (queue.length && Date.now() < sliceEnd) {
        const word = queue.shift() as CloudWord;
        // Arial has no 600 weight, so browsers draw it bold: measuring at the drawn weight keeps words from colliding.
        const sprite = layout.getSprite(word.text, { datum: word, font: "Arial", weight: "bold", size: word.size, rotate: word.rotate, padding: 14 });
        const placedWord = sprite ? layout.place(sprite) : null;
        if (placedWord) result.push({ ...placedWord.datum, x: placedWord.x, y: placedWord.y });
      }
      if (cancelled) return;
      if (queue.length) timer = setTimeout(step, 0);
      else setPlaced(result);
    };
    step();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [terms]);

  const current = new Map(terms.map(({ text, count }) => [text, count]));
  const displayed = placed?.filter(({ text, count }) => current.get(text) === count) ?? [];
  const visible = new Set(displayed.map(({ text }) => text));
  const remaining = terms.filter(({ text }) => !visible.has(text));
  const max = Math.max(1, ...terms.map(({ count }) => count));

  return (
    <PresenterSection title={title}>
      {displayed.length ? (
        <svg viewBox={"0 0 " + WIDTH + " " + HEIGHT} className="mx-auto block w-full max-w-6xl" role="img" aria-label={title}>
          <g transform={"translate(" + WIDTH / 2 + ", " + HEIGHT / 2 + ")"}>
            {displayed.map(({ text, count, size, colour, rotate, x, y }) => (
              <text key={text} x={x} y={y} textAnchor="middle" fontFamily="Arial" fontWeight="bold" fontSize={size} fill={colour}
                transform={"rotate(" + rotate + ", " + x + ", " + y + ")"}>
                <title>{count} {count === 1 ? "response" : "responses"}</title>
                {text}
              </text>
            ))}
          </g>
        </svg>
      ) : null}
      {remaining.length ? (
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-3 text-center text-2xl text-white">
          {remaining.map(({ text, count }) => (
            <li key={text} style={{ fontSize: (1 + 1.5 * Math.sqrt(count / max)) + "rem" }} title={count + (count === 1 ? " response" : " responses")}>{text}</li>
          ))}
        </ul>
      ) : null}
    </PresenterSection>
  );
}
