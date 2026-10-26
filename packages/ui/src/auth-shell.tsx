import type { CSSProperties, ReactNode } from "react";
import { PrismBrandLogo } from "./brand";
import { cn } from "./utils";

export type PrismAuthPortal = "client" | "supplier" | "guest" | "event";

const AUTH_FIELD_COLOURS: Record<PrismAuthPortal, string> = {
  client: "#c01867",
  supplier: "#1c7a70",
  guest: "#c2470a",
  event: "#171216",
};

export interface PrismAuthStepProgress {
  current: number;
  total: number;
  label: string;
}

export interface PrismAuthShellProps {
  portal: PrismAuthPortal;
  portalName: string;
  statement: string;
  points?: readonly string[];
  title: string;
  description?: string;
  homeHref?: string;
  steps?: PrismAuthStepProgress;
  children: ReactNode;
  footer?: ReactNode;
}

export function prismAuthSubmitClassName(portal: PrismAuthPortal) {
  return cn(
    "h-12 w-full rounded-lg text-base font-semibold shadow-none hover:shadow-none sm:text-sm",
    portal === "event" && "bg-foreground hover:bg-foreground/90",
  );
}

/**
 * Border for auth inputs, textareas and code inputs. 0.46 is the lowest foreground opacity that
 * keeps a 3:1 boundary against the form background and the white input fill.
 */
export const PRISM_AUTH_INPUT_CLASS_NAME = "border-foreground/[0.46]";

export function PrismAuthStepIndicator({ current, total, label }: PrismAuthStepProgress) {
  return (
    <div className="mb-6" aria-live="polite">
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={cn("h-1 flex-1 rounded-full", index < current ? "bg-(--prism-auth-field)" : "bg-border")}
          />
        ))}
      </div>
      <p className="mt-3 text-sm font-medium text-muted-foreground">
        Step {current} of {total}: {label}
      </p>
    </div>
  );
}

export function PrismAuthShell({
  portal,
  portalName,
  statement,
  points = [],
  title,
  description,
  homeHref,
  steps,
  children,
  footer,
}: PrismAuthShellProps) {
  return (
    <main
      className="grid min-h-screen bg-background text-foreground lg:grid-cols-2"
      style={{ "--prism-auth-field": AUTH_FIELD_COLOURS[portal] } as CSSProperties}
    >
      <aside className="flex h-[168px] flex-col justify-center bg-(--prism-auth-field) px-6 text-white lg:h-auto lg:min-h-screen lg:justify-between lg:px-14 lg:py-14">
        <PrismBrandLogo dark detail={portalName} />
        <div className="hidden lg:block">
          <p className="max-w-[420px] font-heading text-[44px] font-bold leading-[1.08] text-balance text-white">
            {statement}
          </p>
          {points.length > 0 ? (
            <ul className="mt-8 flex max-w-[420px] flex-col gap-2.5 text-base leading-6 text-white/85">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </aside>

      <section className="flex flex-col px-5 py-6 sm:px-8 lg:min-h-screen lg:px-12 lg:py-10">
        {homeHref ? (
          <a href={homeHref} className="self-start text-sm text-muted-foreground transition-colors hover:text-foreground">
            Back to P.R.I.S.M. home
          </a>
        ) : null}
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-[420px]">
            {steps ? <PrismAuthStepIndicator {...steps} /> : null}
            <h1 className="font-heading text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>
            {description ? <p className="mt-3 text-base leading-6 text-muted-foreground">{description}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-8 space-y-2 text-sm leading-6 text-muted-foreground">{footer}</div> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export interface PrismWrongPortalLink {
  label: string;
  href: string;
}

export function PrismWrongPortalLinks({ links }: { links: readonly PrismWrongPortalLink[] }) {
  return (
    <p>
      Wrong portal?{" "}
      {links.map((link, index) => (
        <span key={link.href}>
          {index > 0 ? ", " : null}
          <a href={link.href} className="text-primary transition-colors hover:text-primary/80">
            {link.label}
          </a>
        </span>
      ))}
    </p>
  );
}
