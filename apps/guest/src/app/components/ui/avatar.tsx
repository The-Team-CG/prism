import * as React from "react";
import { cn } from "./utils";

function Avatar({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("relative flex size-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />;
}

function AvatarImage({ className, ...props }: React.ComponentProps<"img">) {
  return <img className={cn("aspect-square size-full object-cover", className)} {...props} />;
}

function AvatarFallback({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("flex size-full items-center justify-center rounded-full bg-secondary text-sm font-black text-secondary-foreground", className)} {...props} />;
}

export { Avatar, AvatarImage, AvatarFallback };
