"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { CalendarDays } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "../../utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Input } from "./input";

const DATE_VALUE_FORMAT = "yyyy-MM-dd";
const DATE_INPUT_FORMAT = "MM/dd/yyyy";

type DatePickerProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max"
> & {
  value: string;
  onValueChange: (value: string) => void;
  min?: string;
  max?: string;
  calendarButtonAriaLabel?: string;
};

function parseDateValue(value: string | undefined): Date | undefined {
  const dateValue = value?.slice(0, 10);
  if (!dateValue) return undefined;

  const date = parse(dateValue, DATE_VALUE_FORMAT, new Date());
  return isValid(date) && format(date, DATE_VALUE_FORMAT) === dateValue ? date : undefined;
}

function parseInputDate(value: string): Date | undefined {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return undefined;

  const date = parse(value, DATE_INPUT_FORMAT, new Date());
  return isValid(date) && format(date, DATE_INPUT_FORMAT) === value ? date : undefined;
}

function isWithinBounds(date: Date, min?: string, max?: string): boolean {
  const dateValue = format(date, DATE_VALUE_FORMAT);
  return (!min || dateValue >= min.slice(0, 10)) && (!max || dateValue <= max.slice(0, 10));
}

function resolvePreviewMonth(digits: string): Date | undefined {
  if (digits.length < 2) return undefined;

  const month = Number.parseInt(digits.slice(0, 2), 10);
  if (month < 1 || month > 12) return undefined;

  const year = digits.length === 8
    ? Number.parseInt(digits.slice(4, 8), 10)
    : new Date().getFullYear();
  const preview = new Date(year, month - 1, 1);
  return isValid(preview) ? preview : undefined;
}

export function DatePicker({
  value,
  onValueChange,
  min,
  max,
  name,
  className,
  placeholder = "MM/DD/YYYY",
  disabled = false,
  required = false,
  calendarButtonAriaLabel = "Open calendar",
  onFocus,
  onBlur,
  ...inputProps
}: Readonly<DatePickerProps>) {
  const selectedDate = parseDateValue(value);
  const [open, setOpen] = React.useState(false);
  const [inputText, setInputText] = React.useState(
    selectedDate ? format(selectedDate, DATE_INPUT_FORMAT) : "",
  );
  const [calendarMonth, setCalendarMonth] = React.useState(selectedDate ?? new Date());
  const inputRef = React.useRef<HTMLInputElement>(null);
  const openedFromInput = React.useRef(false);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const parsedInputDate = parseInputDate(inputText);
  const inputInvalid = inputText.length > 0 && (
    !parsedInputDate || !isWithinBounds(parsedInputDate, min, max)
  );

  React.useEffect(() => {
    setInputText(selectedDate ? format(selectedDate, DATE_INPUT_FORMAT) : "");
    if (selectedDate) setCalendarMonth(selectedDate);
  }, [value]);

  React.useEffect(() => {
    inputRef.current?.setCustomValidity(
      inputInvalid ? "Enter a valid date within the allowed range." : "",
    );
  }, [inputInvalid]);

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replaceAll(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    setInputText(formatted);
    if (digits.length < 8 && !open) {
      openedFromInput.current = true;
      setOpen(true);
    }
    if (digits.length === 0) {
      onValueChange("");
      return;
    }

    if (digits.length === 8) {
      const date = parseInputDate(formatted);
      if (date && isWithinBounds(date, min, max)) {
        onValueChange(format(date, DATE_VALUE_FORMAT));
        setCalendarMonth(date);
        setOpen(false);
      }
      return;
    }

    const previewMonth = resolvePreviewMonth(digits);
    if (previewMonth) setCalendarMonth(previewMonth);
  }

  function handleInputBlur(event: React.FocusEvent<HTMLInputElement>) {
    if (inputText.length > 0 && inputInvalid) {
      setInputText(selectedDate ? format(selectedDate, DATE_INPUT_FORMAT) : "");
    }
    onBlur?.(event);
  }

  function handleCalendarSelect(date: Date | undefined) {
    if (date && !isWithinBounds(date, min, max)) return;

    onValueChange(date ? format(date, DATE_VALUE_FORMAT) : "");
    setInputText(date ? format(date, DATE_INPUT_FORMAT) : "");
    if (date) setCalendarMonth(date);
    setOpen(false);
  }

  return (
    <div className="relative w-full">
      <Input
        {...inputProps}
        ref={inputRef}
        type="text"
        value={inputText}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        pattern="\d{2}/\d{2}/\d{4}"
        aria-invalid={inputInvalid || inputProps["aria-invalid"]}
        onChange={handleInputChange}
        onFocus={(event) => {
          openedFromInput.current = true;
          setOpen(true);
          onFocus?.(event);
        }}
        onBlur={handleInputBlur}
        className={cn("pr-10", className)}
      />
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Popover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          openedFromInput.current = false;
          setOpen(nextOpen);
        }}
      >
        <Popover.Trigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={calendarButtonAriaLabel}
            onClick={(event) => {
              if (!open || !openedFromInput.current) return;
              // Already open from typing: move into the calendar instead of toggling it closed.
              event.preventDefault();
              openedFromInput.current = false;
              contentRef.current?.querySelector<HTMLButtonElement>('[role="grid"] button[tabindex="0"]')?.focus();
            }}
            className="absolute right-1.5 top-1/2 size-8 -translate-y-1/2 rounded-md text-primary hover:bg-primary-soft hover:text-primary-strong"
          >
            <CalendarDays aria-hidden="true" className="size-4" />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            ref={contentRef}
            align="start"
            sideOffset={4}
            onOpenAutoFocus={(event) => {
              // Typing into the field must keep focus there; only the calendar button moves focus into the grid.
              if (openedFromInput.current) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (event.target === inputRef.current) event.preventDefault();
            }}
            className="z-50 w-auto rounded-xl border border-primary/15 bg-popover p-1 text-popover-foreground shadow-[0_12px_32px_-12px_rgb(192_24_103/0.35)] outline-none"
          >
            <Calendar
              mode="single"
              selected={selectedDate}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onSelect={handleCalendarSelect}
              disabled={(date) => disabled || !isWithinBounds(date, min, max)}
              startMonth={new Date(1900, 0)}
              endMonth={new Date(2100, 11)}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
