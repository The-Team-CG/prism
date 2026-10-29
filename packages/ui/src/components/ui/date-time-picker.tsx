"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarClock, X } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "../../utils";
import { Calendar } from "./calendar";
import { timeOptions } from "./time-picker";

/** Same wire format as `<input type="datetime-local">`, so callers can swap without changing state or payloads. */
const VALUE_FORMAT = "yyyy-MM-dd'T'HH:mm";
const DATE_FORMAT = "yyyy-MM-dd";
const MINUTE_STEP_DEFAULT = 15;

type DateTimePickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  /** Earliest/latest allowed moment, as `yyyy-MM-ddTHH:mm` or a date. */
  min?: string;
  max?: string;
  /** Minutes between time options. */
  minuteStep?: number;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

function parseValue(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = parse(value.slice(0, 16), VALUE_FORMAT, new Date());
  return isValid(date) ? date : undefined;
}

function withinBounds(candidate: string, min?: string, max?: string) {
  return (!min || candidate >= min.slice(0, candidate.length)) && (!max || candidate <= max.slice(0, candidate.length));
}

/** The time list beside the calendar; times outside min/max are disabled for the chosen day. */
function TimeColumn({
  times,
  dateKey,
  timeKey,
  min,
  max,
  listRef,
  canClear,
  onPick,
  onClear,
}: {
  times: { value: string; label: string }[];
  dateKey: string | null;
  timeKey: string | null;
  min?: string;
  max?: string;
  listRef: React.RefObject<HTMLDivElement | null>;
  canClear: boolean;
  onPick: (time: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex w-32 flex-col border-l border-border">
      <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Time</p>
      <div ref={listRef} role="listbox" aria-label="Time" className="max-h-72 flex-1 overflow-y-auto p-1">
        {times.map((option) => {
          const candidate = `${dateKey ?? format(new Date(), DATE_FORMAT)}T${option.value}`;
          const allowed = withinBounds(candidate, min, max);
          const isSelected = option.value === timeKey;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={isSelected}
              data-default={option.value === "09:00" ? "true" : undefined}
              disabled={!allowed}
              onClick={() => onPick(option.value)}
              className={cn(
                "w-full rounded-md px-3 py-1.5 text-left text-sm tabular-nums transition-colors disabled:opacity-35",
                isSelected ? "bg-primary font-semibold text-primary-foreground" : "text-foreground hover:bg-primary-soft",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {canClear ? (
        <button
          type="button"
          onClick={onClear}
          className="flex items-center justify-center gap-1 border-t border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden className="size-3" /> Clear
        </button>
      ) : null}
    </div>
  );
}

export function DateTimePicker({
  value,
  onValueChange,
  min,
  max,
  minuteStep = MINUTE_STEP_DEFAULT,
  id,
  name,
  required = false,
  disabled = false,
  placeholder = "Pick a date and time",
  className,
  ...aria
}: Readonly<DateTimePickerProps>) {
  const selected = parseValue(value);
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(selected ?? new Date());
  const listRef = React.useRef<HTMLDivElement>(null);
  const times = React.useMemo(() => {
    const options = timeOptions(minuteStep);
    const current = selected ? format(selected, "HH:mm") : null;
    // Keep an off-step saved time (e.g. 09:07) selectable instead of silently snapping it.
    if (current && !options.some((option) => option.value === current)) {
      options.push({ value: current, label: format(selected!, "h:mm a") });
      options.sort((left, right) => left.value.localeCompare(right.value));
    }
    return options;
  }, [minuteStep, selected]);
  const dateKey = selected ? format(selected, DATE_FORMAT) : null;
  const timeKey = selected ? format(selected, "HH:mm") : null;

  React.useEffect(() => {
    if (selected) setMonth(selected);
  }, [value]);

  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const target = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? listRef.current?.querySelector<HTMLElement>('[data-default="true"]');
      target?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  function pickDate(date: Date | undefined) {
    if (!date) return;
    const nextDate = format(date, DATE_FORMAT);
    const time = timeKey ?? "09:00";
    onValueChange(`${nextDate}T${time}`);
  }

  function pickTime(time: string) {
    const date = dateKey ?? format(new Date(), DATE_FORMAT);
    onValueChange(`${date}T${time}`);
    setOpen(false);
  }

  const label = selected ? format(selected, "MMM d, yyyy · h:mm a") : placeholder;

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
            aria-label={aria["aria-label"] ? `${aria["aria-label"]}: ${selected ? label : "not set"}` : undefined}
            aria-describedby={aria["aria-describedby"]}
            className={cn(
              "relative flex h-10 w-full items-center gap-2 rounded-md border border-border bg-white px-3 text-left text-sm outline-none transition-colors",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <CalendarClock aria-hidden className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={4}
            className="z-50 flex w-auto overflow-hidden rounded-xl border border-primary/15 bg-popover text-popover-foreground shadow-[0_12px_32px_-12px_rgb(192_24_103/0.35)] outline-none"
          >
            <div className="p-1">
              <Calendar
                mode="single"
                selected={selected}
                month={month}
                onMonthChange={setMonth}
                onSelect={pickDate}
                disabled={(date) => !withinBounds(format(date, DATE_FORMAT), min, max)}
                startMonth={new Date(1900, 0)}
                endMonth={new Date(2100, 11)}
              />
            </div>
            <TimeColumn
              times={times}
              dateKey={dateKey}
              timeKey={timeKey}
              min={min}
              max={max}
              listRef={listRef}
              canClear={Boolean(value) && !required}
              onPick={pickTime}
              onClear={() => {
                onValueChange("");
                setOpen(false);
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
