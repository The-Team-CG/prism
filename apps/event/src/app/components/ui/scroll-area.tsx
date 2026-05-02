import * as React from "react";
import { cn } from "./utils";

function ScrollArea({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("overflow-auto", className)} {...props} />;
}

export { ScrollArea };
