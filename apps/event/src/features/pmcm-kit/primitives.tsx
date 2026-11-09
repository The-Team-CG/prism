import { cx } from "./helpers";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@prism/ui/components/card";

export function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Card className="gap-0 rounded-lg border-primary/12 bg-card shadow-none">
      <CardHeader className="flex min-h-12 flex-row items-center gap-2 border-b border-border px-4 py-0">
        <Icon className="size-4 text-attention" />
        <CardTitle className="text-sm font-black text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

export function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <Card className="gap-0 rounded-lg border-primary/12 bg-card p-4 shadow-none">
      <div className="flex items-center justify-between gap-3">
        <div className="grid size-10 place-items-center rounded-md bg-secondary text-foreground">
          <Icon className="size-5" />
        </div>
        <p className="text-right text-2xl font-black text-foreground">{value}</p>
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
    </Card>
  );
}

export type SegmentedOption = { value: string; label: string; count?: number };

/**
 * The one segmented filter/tab style for PMCM views: a muted track with a raised active segment.
 * Each segment is a toggle button (aria-pressed), so filters stay plain buttons for keyboard and screen readers.
 */
export function SegmentedControl({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cx("flex max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cx(
              "inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
            {option.count ? <span className="rounded-full bg-background px-1.5 text-xs tabular-nums text-muted-foreground">{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
