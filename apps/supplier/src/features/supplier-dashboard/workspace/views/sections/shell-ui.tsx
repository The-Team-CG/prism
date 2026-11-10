"use client";

import { isZeroFigure } from "@prism/ui/figures";

import { useState, type ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { Card as SharedCard } from "@prism/ui/components/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@prism/ui/components/collapsible";

/** A section that folds: the trigger is a ghost button with a chevron, the body is the collapsible content. */
export function Disclosure({
  trigger, defaultOpen = false, className, id, children,
}: { trigger: ReactNode; defaultOpen?: boolean; className?: string; id?: string; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible id={id} open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" className="h-auto w-full justify-start gap-3 whitespace-normal px-4 py-3 text-left font-normal">
          <ChevronRight className={`mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} aria-hidden="true" />
          {trigger}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border px-4 py-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

/** The shared card surface; `gap-0` keeps the header/body stacking these pages were laid out with. */
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <SharedCard className={`min-w-0 gap-0 ${className}`}>{children}</SharedCard>;
}
export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`border-b border-border px-4 py-4 sm:px-6 [&_h2]:text-base! [&_h2]:font-semibold! [&_h3]:text-base! [&_h3]:font-semibold! ${className}`}>{children}</div>;
}
export function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-4 py-5 sm:px-6 ${className}`}>{children}</div>;
}
/** Small context label above a record title: sentence case, muted, never a tracked uppercase eyebrow. */
export function SectionAccent({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** A KPI is a label over a figure; the icon prop is kept for call-site compatibility but not drawn. */
export function StatCell({
  label, value, sub,
}: { label: string; value: string | number; sub?: string; icon?: LucideIcon; accent?: boolean }) {
  return (
    <SharedCard className="min-w-0 gap-0 px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold leading-tight tabular-nums ${isZeroFigure(value) ? "text-muted-foreground/60" : "text-foreground"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </SharedCard>
  );
}
