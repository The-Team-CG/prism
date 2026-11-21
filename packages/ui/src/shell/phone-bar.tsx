"use client";

import * as React from "react";
import { Ellipsis } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet";
import { portalHref } from "../portal-path";
import { cn } from "../utils";
import { AccountMenuEntries, initialsFor } from "./account-menu";
import { groupNav, hasBadge, isItemActive, moreState, navLinkClick, type ResolvedMobileBar } from "./nav-model";
import type { PrismAppShellProps, PrismMobileTabAction, PrismNavItem, PrismNavSubItem, PrismUserSummary } from "./types";

type Select = (id: string) => void;

const COUNT_CLASS = "absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white";
const TAB_CLASS = "flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium outline-none focus-visible:bg-muted";

/** A link when the destination has a route, so it can open in a new tab; otherwise a button the portal resolves. */
function Destination({ item, current, onSelect, className, children, ...rest }: {
  item: Pick<PrismNavItem, "id" | "href" | "disabled">;
  current: boolean;
  onSelect: Select;
  className: string;
  children: React.ReactNode;
  "aria-label"?: string;
  "data-nav-covers"?: string;
}) {
  if (item.href && !item.disabled) {
    return (
      <a data-nav-id={item.id} href={portalHref(item.href)} aria-current={current ? "page" : undefined} className={className} onClick={(event) => navLinkClick(event, () => onSelect(item.id))} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button data-nav-id={item.id} type="button" disabled={item.disabled} aria-current={current ? "page" : undefined} className={className} onClick={() => onSelect(item.id)} {...rest}>
      {children}
    </button>
  );
}

function MobileTab({ item, activeId, onSelect }: { item: PrismNavItem; activeId: string; onSelect: Select }) {
  // A tab can stand for several pages; it lights up on any of them, listed as its subItems.
  const current = isItemActive(item, activeId);
  return (
    <li className="min-w-0">
      <Destination item={item} current={current} onSelect={onSelect} data-nav-covers={item.subItems?.map((sub) => sub.id).join(" ")} className={cn(TAB_CLASS, current ? "text-primary" : "text-muted-foreground")}>
        <span className="relative">
          <item.icon aria-hidden="true" className="size-5" />
          {hasBadge(item.badge) ? <span aria-label={item.badgeLabel} className={COUNT_CLASS}>{item.badge}</span> : null}
        </span>
        <span className="truncate">{item.shortLabel ?? item.label}</span>
      </Destination>
    </li>
  );
}

/** The raised centre button: the portal's one urgent action, never covering the page. */
function MobileCenterAction({ action }: { action: PrismMobileTabAction }) {
  return (
    <li className="min-w-0">
      <button type="button" aria-label={action.ariaLabel ?? action.label} onClick={action.onSelect} className="flex min-h-14 w-full flex-col items-center justify-end gap-1 pb-1.5 text-[11px] font-semibold text-primary outline-none">
        <span className="-mt-6 grid size-13 place-items-center rounded-full border-4 border-card bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <action.icon aria-hidden="true" className="size-5" />
        </span>
        <span className="truncate">{action.label}</span>
      </button>
    </li>
  );
}

function MoreRow({ item, depth, activeId, onSelect }: { item: PrismNavItem | PrismNavSubItem; depth: 0 | 1; activeId: string; onSelect: Select }) {
  const current = item.id === activeId;
  const icon = "icon" in item ? <item.icon aria-hidden="true" className="size-5 shrink-0" /> : null;
  return (
    <li>
      <Destination
        item={item}
        current={current}
        onSelect={onSelect}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          depth === 1 && "pl-11",
          current ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-muted",
        )}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {hasBadge(item.badge) ? <span className="shrink-0 rounded-full bg-muted px-2 text-xs font-semibold tabular-nums text-foreground">{item.badge}</span> : null}
      </Destination>
    </li>
  );
}

/** Every page that is not a tab, grouped as the sidebar groups them, in a sheet from the bottom. */
function MoreSheet({ items, activeId, open, onOpenChange, onSelect }: { items: PrismNavItem[]; activeId: string; open: boolean; onOpenChange: (open: boolean) => void; onSelect: Select }) {
  const choose = (id: string) => {
    onOpenChange(false);
    onSelect(id);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)] md:hidden">
        <SheetHeader className="pb-2">
          <SheetTitle>More</SheetTitle>
          <SheetDescription className="sr-only">Every other page in this portal.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 px-2 pb-4">
          {groupNav(items).map((group) => (
            <section key={group.label} aria-label={group.label} className="grid gap-1">
              <h3 className="px-3 text-xs font-medium text-muted-foreground">{group.label}</h3>
              <ul className="grid gap-0.5">
                {group.items.map((item) => (
                  <React.Fragment key={item.id}>
                    <MoreRow item={item} depth={0} activeId={activeId} onSelect={choose} />
                    {item.subItems?.map((sub) => <MoreRow key={sub.id} item={sub} depth={1} activeId={activeId} onSelect={choose} />)}
                  </React.Fragment>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MoreTab({ items, activeId, onSelect }: { items: PrismNavItem[]; activeId: string; onSelect: Select }) {
  const [open, setOpen] = React.useState(false);
  const { active, hasNews } = moreState(items, activeId);
  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={hasNews ? "More, has updates" : "More"}
        aria-current={active ? "page" : undefined}
        className={cn(TAB_CLASS, active || open ? "text-primary" : "text-muted-foreground")}
        onClick={() => setOpen(true)}
      >
        <span className="relative">
          <Ellipsis aria-hidden="true" className="size-5" />
          {hasNews ? <span aria-hidden="true" className="absolute -right-1 -top-0.5 size-2 rounded-full bg-danger ring-2 ring-card" /> : null}
        </span>
        <span className="truncate">More</span>
      </button>
      <MoreSheet items={items} activeId={activeId} open={open} onOpenChange={setOpen} onSelect={onSelect} />
    </li>
  );
}

/** The phone tab bar: the portal's tabs within thumb reach, its urgent action raised in the middle, and More last. */
export function PhoneTabBar({ bar, activeId, onSelect }: { bar: ResolvedMobileBar; activeId: string; onSelect: Select }) {
  const hasMore = bar.more.length > 0;
  const slots = bar.tabs.length + (bar.action ? 1 : 0) + (hasMore ? 1 : 0);
  const beforeAction = Math.min(Math.floor(slots / 2), bar.tabs.length);
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
        {bar.tabs.slice(0, beforeAction).map((item) => <MobileTab key={item.id} item={item} activeId={activeId} onSelect={onSelect} />)}
        {bar.action ? <MobileCenterAction action={bar.action} /> : null}
        {bar.tabs.slice(beforeAction).map((item) => <MobileTab key={item.id} item={item} activeId={activeId} onSelect={onSelect} />)}
        {hasMore ? <MoreTab items={bar.more} activeId={activeId} onSelect={onSelect} /> : null}
      </ul>
    </nav>
  );
}

/** Icons in the phone top bar, such as messages and notifications, with their counts read out in the name. */
export function PhoneHeaderIcons({ items, activeId, onSelect }: { items: PrismNavItem[]; activeId: string; onSelect: Select }) {
  return (
    <>
      {items.map((item) => {
        const count = hasBadge(item.badge) ? item.badgeLabel ?? String(item.badge) : undefined;
        return (
          <Destination
            key={item.id}
            item={item}
            current={isItemActive(item, activeId)}
            onSelect={onSelect}
            aria-label={count ? `${item.label}, ${count}` : item.label}
            className={cn(
              "relative grid size-11 shrink-0 place-items-center rounded-full outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
              isItemActive(item, activeId) ? "text-primary" : "text-foreground",
            )}
          >
            <item.icon aria-hidden="true" className="size-5" />
            {count ? <span aria-hidden="true" className="absolute right-1 top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-semibold leading-4 text-white">{item.badge}</span> : null}
          </Destination>
        );
      })}
    </>
  );
}

/** The account menu behind the avatar at the end of the phone top bar. */
export function PhoneAccountMenu({ user, items, onSignOut }: { user: PrismUserSummary; items?: PrismAppShellProps["accountMenuItems"]; onSignOut?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Your account" className="grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-ink text-[11px] font-semibold text-ink-foreground">{initialsFor(user.name, user.initials)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <AccountMenuEntries user={user} items={items} onSignOut={onSignOut} rowClassName="min-h-11" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
