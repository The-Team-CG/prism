import * as React from "react";
import { cn } from "./utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gradient-to-r from-muted/80 via-muted/50 to-muted/80 ring-1 ring-border/30",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
