import { cx } from "./helpers";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { isZeroFigure } from "@prism/ui/figures";

import { Card, CardContent, CardHeader, CardTitle } from "@prism/ui/components/card";
import { ToggleGroup, ToggleGroupItem } from "@prism/ui/components/toggle-group";

export function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <Card className="gap-0 rounded-lg border-border bg-card shadow-none">
      <CardHeader className="flex min-h-12 flex-row items-center gap-2 border-b border-border px-4 py-0">
        <Icon className="size-4 text-attention" />
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

export function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <Card className="gap-0 rounded-lg border-border bg-card p-4 shadow-none">
      <div className="flex items-center justify-between gap-3">
        <div className="grid size-10 place-items-center rounded-md bg-secondary text-foreground">
          <Icon className="size-5" />
        </div>
        <p className={cx("text-right text-2xl font-semibold tabular-nums", isZeroFigure(value) ? "text-muted-foreground/60" : "text-foreground")}>{value}</p>
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
    </Card>
  );
}

export type SegmentedOption = { value: string; label: string; count?: number };

/**
 * The one segmented filter/mode style for PMCM views, built on the shared single-selection ToggleGroup.
 * Choosing the active option again keeps it selected, so the group always has a value.
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
    <ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      className={cx("max-w-full flex-wrap rounded-lg bg-muted p-1", className)}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="min-h-8 gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >
          {option.label}
          {option.count ? <span className="rounded-full bg-background px-1.5 text-xs tabular-nums text-muted-foreground">{option.count}</span> : null}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
