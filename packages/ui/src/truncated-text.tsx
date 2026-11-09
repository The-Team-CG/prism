"use client";

import * as React from "react";
import { cn } from "./utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./components/ui/tooltip";

const isClipped = (element: HTMLElement) => element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;

/**
 * Text clipped to one line (or two lines) that shows the full value in a tooltip only while it is actually
 * clipped. Clipping is measured when the tooltip opens, so no layout observer runs for every rendered label.
 * Requires a `TooltipProvider` above it, which every portal shell and the calendar already mount.
 */
export function TruncatedText({ children, className, lines = 1 }: { children: string; className?: string; lines?: 1 | 2 }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [open, setOpen] = React.useState(false);
  const [clipped, setClipped] = React.useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next && ref.current) setClipped(isClipped(ref.current));
    setOpen(next);
  };

  return (
    <Tooltip open={open && clipped} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>
        <span ref={ref} className={cn(lines === 1 ? "block truncate" : "line-clamp-2 break-words", className)}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
