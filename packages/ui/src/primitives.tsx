"use client";

import type * as React from "react";
import { cn } from "./utils";

export interface PrismButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}

const buttonVariants: Record<NonNullable<PrismButtonProps["variant"]>, string> = {
  default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/92",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/78",
  outline: "border border-border bg-card text-foreground hover:bg-secondary",
  ghost: "text-foreground hover:bg-secondary",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
};

const buttonSizes: Record<NonNullable<PrismButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-sm",
  icon: "size-10 p-0",
};

export function PrismButton({
  className,
  variant = "default",
  size = "md",
  type = "button",
  ...props
}: PrismButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-bold transition disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    />
  );
}

export type PrismBadgeTone = "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "info" | "neutral";

export interface PrismBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: PrismBadgeTone;
  tone?: PrismBadgeTone;
}

const badgeVariants: Record<PrismBadgeTone, string> = {
  default: "bg-primary/10 text-primary ring-primary/15",
  secondary: "bg-secondary text-secondary-foreground ring-border",
  outline: "bg-card text-foreground ring-border",
  success: "bg-(--prism-success)/10 text-(--prism-success) ring-(--prism-success)/20",
  warning: "bg-(--prism-amber)/10 text-(--prism-amber) ring-(--prism-amber)/20",
  danger: "bg-(--prism-danger)/10 text-(--prism-danger) ring-(--prism-danger)/20",
  info: "bg-primary/10 text-primary ring-primary/20",
  neutral: "bg-muted text-muted-foreground ring-border",
};

export function PrismBadge({ className, variant = "default", tone, ...props }: PrismBadgeProps) {
  const resolvedVariant = tone ?? variant;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1",
        badgeVariants[resolvedVariant],
        className,
      )}
      {...props}
    />
  );
}

export function PrismCard({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("rounded-lg border border-border bg-card shadow-sm", className)} {...props} />;
}

export function PrismCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pb-3 sm:p-5 sm:pb-3.5", className)} {...props} />;
}

export function PrismCardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props} />;
}

export function PrismCardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-black text-foreground", className)} {...props} />;
}

export function PrismCardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />;
}

export function PrismInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function PrismTextarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

export function PrismSkeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-secondary", className)} {...props} />;
}

export function PrismSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-px w-full bg-border", className)} {...props} />;
}
