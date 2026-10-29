"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { Clock, X } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "../../utils";

const MINUTE_STEP_DEFAULT = 15;

/** Every time of day in `step`-minute increments, as `HH:mm` values with "6:30 PM" labels. */
export function timeOptions(step: number) {
  const options: { value: string; label: string }[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    const hours = Math.floor(minutes / 60);
    const value = `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    options.push({ value, label: timeLabel(value) });
  }
  return options;
}

/** "18:30" → "6:30 PM"; anything unreadable comes back unchanged. */
export function timeLabel(value: string) {
  const date = parse(value.slice(0, 5), "HH:mm", new Date());
  return isValid(date) ? format(date, "h:mm a") : value;
}

type TimePickerProps = {
  /** `HH:mm`, the same value `<input type="time">` produces. */
  value: string;
  onValueChange: (value: string) => void;
  /** Earliest/latest allowed time as `HH:mm`. */
  min?: string;
  max?: string;
  minuteStep?: number;
  /** Where the list opens when nothing is chosen yet. */
  scrollTo?: string;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

export function TimePicker({
  value,
  onValueChange,
  min,
  max,
  minuteStep = MINUTE_STEP_DEFAULT,
  scrollTo = "09:00",
  id,
  name,
  required = false,
  disabled = false,
  placeholder = "Pick a time",
  className,
  ...aria
}: Readonly<TimePickerProps>) {
  const [open, setOpen] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const current = value ? value.slice(0, 5) : "";
  const options = React.useMemo(() => {
    const list = timeOptions(minuteStep);
    // Keep an off-step saved time (e.g. 18:07) selectable instead of silently snapping it.
    if (current && !list.some((option) => option.value === current)) {
      list.push({ value: current, label: timeLabel(current) });
      list.sort((left, right) => left.value.localeCompare(right.value));
    }
    return list;
  }, [current, minuteStep]);

  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const target = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? listRef.current?.querySelector<HTMLElement>(`[data-value="${scrollTo}"]`);
      target?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, scrollTo]);

  const label = current ? timeLabel(current) : placeholder;

  return (
    <div className={cn("relative w-full", className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      {/* Keeps native required-field validation working on the button-driven picker. */}
      {required ? <input tabIndex={-1} aria-hidden className="pointer-events-none absolute inset-0 opacity-0" required value={value} onChange={() => undefined} /> : null}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={aria["aria-label"] ? `${aria["aria-label"]}: ${current ? label : "not set"}` : undefined}
            aria-describedby={aria["aria-describedby"]}
            className={cn(
              "relative flex h-10 w-full items-center gap-2 rounded-md border border-border bg-white px-3 text-left text-sm outline-none transition-colors",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50",
              current ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <Clock aria-hidden className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate tabular-nums">{label}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 flex w-40 flex-col overflow-hidden rounded-xl border border-primary/15 bg-popover text-popover-foreground shadow-[0_12px_32px_-12px_rgb(192_24_103/0.35)] outline-none"
          >
            <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Time</p>
            <div ref={listRef} role="listbox" aria-label="Time" className="max-h-72 overflow-y-auto p-1">
              {options.map((option) => {
                const allowed = (!min || option.value >= min.slice(0, 5)) && (!max || option.value <= max.slice(0, 5));
                const selected = option.value === current;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-value={option.value}
                    disabled={!allowed}
                    onClick={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full rounded-md px-3 py-1.5 text-left text-sm tabular-nums transition-colors disabled:opacity-35",
                      selected ? "bg-primary font-semibold text-primary-foreground" : "text-foreground hover:bg-primary-soft",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {value && !required ? (
              <button
                type="button"
                onClick={() => {
                  onValueChange("");
                  setOpen(false);
                }}
                className="flex items-center justify-center gap-1 border-t border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <X aria-hidden className="size-3" /> Clear
              </button>
            ) : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
