import type { ReactNode } from "react";

export type SegmentOption<T extends string> = { value: T; label: ReactNode; title?: string };

type SegmentedProps<T extends string> = {
  /** Names the group for assistive technology. */
  label: string;
  options: ReadonlyArray<SegmentOption<T>>;
  value: T | null;
  onChange(value: T): void;
  /** Stretch across the container, each option taking an equal share. */
  fill?: boolean;
  /** Draw the muted track; off when the control sits on a surface of its own. */
  track?: boolean;
};

/**
 * The editor's one pick-one control: the view, the lens, the side panel's tabs and the table shape all use it, so
 * every choice of this kind looks and behaves the same.
 */
export function Segmented<T extends string>({ label, options, value, onChange, fill = false, track = true }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={`${fill ? "flex w-full" : "inline-flex"} gap-0.5 rounded-[9px] ${track ? "bg-muted p-0.5" : ""}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          title={option.title}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`${fill ? "flex-1" : ""} inline-flex h-7 items-center justify-center gap-1.5 rounded-[7px] px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-[0_0_0_0.5px_rgb(24_19_26/0.12),0_1px_2px_rgb(24_19_26/0.08)]`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
