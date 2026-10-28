"use client";

import * as React from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, useDayPicker, type MonthCaptionProps } from "react-day-picker";
import { cn } from "../../utils";
import { buttonVariants } from "./button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

type CalendarOption = { value: number; label: string };

function CalendarSelect({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  options: CalendarOption[];
  className?: string;
  ariaLabel: string;
}) {
  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn(
          "appearance-none cursor-pointer rounded-lg border border-primary/20 bg-primary-soft",
          "py-1 pl-2.5 pr-7 text-sm font-semibold text-primary-deep",
          "transition-colors hover:border-primary/50",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-primary"
        aria-hidden="true"
      />
    </div>
  );
}

function CalendarCaption({ calendarMonth }: MonthCaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useDayPicker();
  const date = calendarMonth.date;
  const monthOptions = Array.from({ length: 12 }, (_, month) => ({
    value: month,
    label: new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2000, month, 1)),
  }));
  const yearOptions = Array.from({ length: 201 }, (_, index) => {
    const year = 1900 + index;
    return { value: year, label: String(year) };
  });
  const navButtonClass = cn(
    buttonVariants({ variant: "ghost", size: "icon-sm" }),
    "h-8 w-8 rounded-lg text-primary hover:bg-primary-soft hover:text-primary-strong",
    "disabled:pointer-events-none disabled:opacity-40",
  );

  function changeMonth(month: number) {
    const nextDate = new Date(date.getFullYear(), date.getMonth(), 1);
    nextDate.setMonth(month);
    goToMonth(nextDate);
  }

  function changeYear(year: number) {
    const nextDate = new Date(date.getFullYear(), date.getMonth(), 1);
    nextDate.setFullYear(year);
    goToMonth(nextDate);
  }

  return (
    <div className="flex h-9 items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => previousMonth && goToMonth(previousMonth)}
        disabled={!previousMonth}
        aria-label="Previous month"
        className={navButtonClass}
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>
      <div className="flex items-center gap-1.5">
        <CalendarSelect
          ariaLabel="Choose month"
          value={date.getMonth()}
          onChange={changeMonth}
          options={monthOptions}
        />
        <CalendarSelect
          ariaLabel="Choose year"
          value={date.getFullYear()}
          onChange={changeYear}
          options={yearOptions}
        />
      </div>
      <button
        type="button"
        onClick={() => nextMonth && goToMonth(nextMonth)}
        disabled={!nextMonth}
        aria-label="Next month"
        className={navButtonClass}
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        root: "w-fit",
        months: "flex flex-col",
        month: "space-y-3",
        month_caption: "",
        dropdowns: "flex items-center gap-1.5",
        caption_label: "text-sm font-medium text-foreground",
        nav: "hidden",
        button_previous: "",
        button_next: "",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-center text-xs font-semibold text-primary/70",
        weeks: "mt-1",
        week: "mt-1 flex w-full",
        day: "relative size-9 p-0 text-center text-sm",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 rounded-lg p-0 font-normal text-sm text-foreground",
          "hover:bg-primary-soft hover:text-primary-strong",
          "focus-visible:ring-2 focus-visible:ring-ring",
          "aria-selected:opacity-100",
        ),
        selected:
          "[&>button]:bg-primary [&>button]:font-semibold [&>button]:text-primary-foreground [&>button]:hover:bg-primary-strong [&>button]:hover:text-primary-foreground",
        today: "[&>button]:font-semibold [&>button]:text-primary [&>button]:shadow-[inset_0_0_0_1px_var(--color-primary)]",
        outside:
          "[&>button]:text-muted-foreground/60 aria-selected:[&>button]:bg-primary-soft aria-selected:[&>button]:text-primary",
        disabled: "[&>button]:cursor-not-allowed [&>button]:text-muted-foreground/35 [&>button]:hover:bg-transparent [&>button]:line-through",
        range_start: "rounded-l-md [&>button]:bg-primary [&>button]:text-primary-foreground",
        range_middle: "bg-primary-soft [&>button]:text-primary [&>button]:hover:bg-primary/15",
        range_end: "rounded-r-md [&>button]:bg-primary [&>button]:text-primary-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{ MonthCaption: CalendarCaption }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
