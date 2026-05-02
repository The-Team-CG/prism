import * as React from "react";
import { cn } from "./utils";

function DropdownMenu({ className, ...props }: React.ComponentProps<"details">) {
  return <details className={cn("relative", className)} {...props} />;
}

function DropdownMenuTrigger({ className, ...props }: React.ComponentProps<"summary">) {
  return <summary className={cn("list-none marker:hidden", className)} {...props} />;
}

function DropdownMenuContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("absolute right-0 top-full z-10 mt-2 min-w-44 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl", className)} {...props} />;
}

function DropdownMenuItem({ className, ...props }: React.ComponentProps<"button">) {
  return <button className={cn("flex h-9 w-full items-center rounded-md px-3 text-left text-sm font-semibold hover:bg-secondary", className)} {...props} />;
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
