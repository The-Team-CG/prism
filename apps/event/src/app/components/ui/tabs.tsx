"use client";

import * as React from "react";
import { cn } from "./utils";

function Tabs({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-3", className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1", className)} {...props} />;
}

function TabsTrigger({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-bold text-muted-foreground transition-colors data-[state=active]:bg-card data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
