"use client";

import type * as React from "react";
import { cn } from "./utils";

const PRISM_LOGO_SRC = new URL("../assets/images/prism-logo.png", import.meta.url).toString();

export interface PrismBrandLogoProps {
  href?: string;
  title?: string;
  detail?: string;
  dark?: boolean;
  compact?: boolean;
  className?: string;
  markClassName?: string;
  textClassName?: string;
}

function PrismBrandLogoContent({
  title = "P.R.I.S.M.",
  detail,
  dark = false,
  compact = false,
  markClassName,
  textClassName,
}: Omit<PrismBrandLogoProps, "href" | "className">) {
  return (
    <>
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center overflow-hidden rounded-md bg-card",
          dark ? "ring-1 ring-white/14" : "ring-1 ring-primary/12",
          compact && "size-9",
          markClassName,
        )}
      >
        <img src={PRISM_LOGO_SRC} alt="" aria-hidden="true" className="size-full object-contain p-0.5" />
      </span>
      <span className={cn("min-w-0", compact && "sr-only", textClassName)}>
        <span
          className={cn(
            "block truncate text-sm font-black leading-4",
            dark ? "text-sidebar-foreground" : "text-foreground",
          )}
        >
          {title}
        </span>
        {detail ? (
          <span
            className={cn(
              "mt-0.5 block truncate text-xs font-semibold leading-4",
              dark ? "text-sidebar-foreground/70" : "text-muted-foreground",
            )}
          >
            {detail}
          </span>
        ) : null}
      </span>
    </>
  );
}

export function PrismBrandLogo({
  href,
  title,
  detail,
  dark,
  compact,
  className,
  markClassName,
  textClassName,
}: PrismBrandLogoProps) {
  const content = (
    <PrismBrandLogoContent
      title={title}
      detail={detail}
      dark={dark}
      compact={compact}
      markClassName={markClassName}
      textClassName={textClassName}
    />
  );

  if (href) {
    return (
      <a href={href} className={cn("inline-flex min-w-0 items-center gap-3 no-underline", className)}>
        {content}
      </a>
    );
  }

  return <div className={cn("inline-flex min-w-0 items-center gap-3", className)}>{content}</div>;
}
