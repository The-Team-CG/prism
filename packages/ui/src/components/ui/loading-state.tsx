import { cn } from "../../utils";
import { Skeleton } from "./skeleton";

interface LoadingStateProps {
  /** What is loading, for example "Loading suppliers…". Read aloud; not shown. */
  label: string;
  /** How many placeholder lines to draw. */
  lines?: number;
  className?: string;
}

/** Placeholder lines for content that is on its way, so the page keeps its shape instead of showing a line of text. */
export function LoadingState({ label, lines = 3, className }: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className={cn("grid gap-2", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} aria-hidden="true" className={cn("h-4", index === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
