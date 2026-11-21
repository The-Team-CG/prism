"use client";

import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { SpotifyMusicControl } from "../spotify-music";
import { PrismBrandLogo } from "../brand";
import { cn } from "../utils";
import { useDocumentTitle } from "../document-title";
import { portalHref } from "../portal-path";
import type { ResolvedMobileBar } from "./nav-model";
import { PhoneTabBar } from "./phone-bar";
import { portalBackgroundStyle } from "./portal-background";

/** One guest destination: a tab in the shared phone bar, and a pill in the header on wider screens. */
export interface PrismGuestTab {
  href: string;
  label: string;
  icon: LucideIcon;
  current?: boolean;
  /** A short count or marker, such as a game waiting. Read out with the label. */
  badge?: string;
}

/**
 * How the page uses a wide screen. `column`: one reading column. `wide`: one column with room for a grid. `split`: the lead (the pass, the prompt) stays on the left
 * while the page's actions run on the right. `narrow`: one short card centred, for a code or a QR.
 */
export type PrismGuestLayout = "column" | "wide" | "split" | "narrow";

export interface PrismGuestShellProps {
  /** The event this pass opens, shown as the page title. */
  eventName: string;
  /** One line under the title: the date and anything the guest shows at the door. */
  detail?: React.ReactNode;
  /** Replaces the title block with the page's own lead, such as the pass itself. It must carry the page's h1. */
  lead?: React.ReactNode;
  /** Right side of the top bar, such as leaving the pass. */
  actions?: React.ReactNode;
  /** The bottom bar on a phone, and links in the header on a wider screen. Omitted when the guest has no pass open. */
  tabs?: readonly PrismGuestTab[];
  layout?: PrismGuestLayout;
  children: React.ReactNode;
  className?: string;
}

/** The guest's tabs as the shared phone bar's items: each tab is its own route, so the item id is its href. */
function guestPhoneBar(tabs: readonly PrismGuestTab[]): ResolvedMobileBar {
  return { tabs: tabs.map(({ href, label, icon, badge }) => ({ id: href, href, label, icon, badge })), header: [], more: [] };
}

/** Guest tabs are plain pages: a click that the phone bar keeps for itself still opens the page. */
function openGuestTab(href: string) {
  window.location.assign(portalHref(href));
}

/** On a tablet or desktop the same tabs sit in the header, as pills around icon and label, never underlined. */
function GuestHeaderTabs({ tabs }: { tabs: readonly PrismGuestTab[] }) {
  return (
    <nav aria-label="Guest pass" className="hidden md:block">
      <ul className="flex gap-1">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <a
              href={portalHref(tab.href)}
              aria-current={tab.current ? "page" : undefined}
              className={cn(
                "relative flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab.current && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
              )}
            >
              <tab.icon aria-hidden="true" className="size-4" />
              {tab.label}
              {tab.badge ? <span className="grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">{tab.badge}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const MAIN_WIDTH: Record<PrismGuestLayout, string> = {
  column: "max-w-3xl",
  wide: "max-w-5xl",
  split: "max-w-5xl",
  narrow: "max-w-md",
};

/** The guest portal frame: one event, a few tabs, and a layout that uses a wide screen instead of stretching a phone. */
export function PrismGuestShell({ eventName, detail, lead, actions, tabs, layout = "column", children, className }: PrismGuestShellProps) {
  useDocumentTitle(eventName ? `${eventName} · P.R.I.S.M.` : undefined);
  const hasTabs = Boolean(tabs?.length);
  const split = layout === "split";
  const current = tabs?.find((tab) => tab.current);
  return (
    <div className={cn("prism-shell min-h-screen bg-background text-foreground", className)} data-portal="guest" style={portalBackgroundStyle}>
      {/* With a pass open, a phone gets the same top bar as every signed-in portal: the tab's name, then its icons. */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6 md:h-16 md:gap-6">
          <PrismBrandLogo href="/" title="P.R.I.S.M." detail="Guest pass" className={cn(hasTabs && "max-md:hidden")} markClassName="size-8 rounded-md bg-card ring-1 ring-border" />
          {hasTabs ? <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground md:hidden">{current?.label ?? eventName}</p> : null}
          {hasTabs ? <GuestHeaderTabs tabs={tabs!} /> : null}
          <div className={cn("ml-auto flex shrink-0 items-center gap-2", hasTabs && "max-md:-mr-2 max-md:gap-0")}><SpotifyMusicControl />{actions}</div>
        </div>
      </header>
      {hasTabs ? <PhoneTabBar bar={guestPhoneBar(tabs!)} activeId={current?.href ?? ""} onSelect={openGuestTab} /> : null}
      <main
        className={cn(
          "mx-auto w-full px-4 py-5 sm:px-6 sm:py-8",
          MAIN_WIDTH[layout],
          hasTabs && "pb-28 md:pb-10",
          split && "lg:grid lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start lg:gap-8",
        )}
      >
        {lead ? (
          <div className={cn("mb-4", split && "lg:sticky lg:top-8 lg:mb-0")}>{lead}</div>
        ) : (
          <div className="mb-4 grid gap-1">
            <h1 className="font-heading text-2xl font-semibold leading-tight text-foreground">{eventName}</h1>
            {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
          </div>
        )}
        <div className="min-w-0">{children}</div>
      </main>
    </div>
  );
}
