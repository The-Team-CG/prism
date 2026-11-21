"use client";

import * as React from "react";
import { SpotifyMusicControl } from "../spotify-music";
import { portalBackgroundStyle } from "./portal-background";
import { ChevronRight, ChevronsUpDown, Search } from "lucide-react";
import type { PrismAppShellProps, PrismCommandGroup, PrismNavItem, PrismPageAction } from "./types";
import { AccountMenuEntries, initialsFor } from "./account-menu";
import { findTrail, groupNav, hasBadge, isItemActive, navLinkClick, resolveMobileBar, type ResolvedMobileBar } from "./nav-model";
import { PhoneAccountMenu, PhoneHeaderIcons, PhoneTabBar } from "./phone-bar";
import { PrismBrandLogo } from "../brand";
import { cn } from "../utils";
import { portalHref } from "../portal-path";
import { useDocumentTitle } from "../document-title";
import { TruncatedText } from "../truncated-text";
import { substringCommandFilter } from "./command-filter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Separator } from "../components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "../components/ui/sidebar";
import { TooltipProvider } from "../components/ui/tooltip";

export type PrismPortal = "client" | "supplier" | "guest" | "event";

function SidebarBrand({ href, title, detail }: { href: string; title: string; detail: string }) {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  return (
    <PrismBrandLogo
      href={href}
      title={title}
      detail={detail}
      compact={collapsed}
      className={cn("min-h-12 px-1", collapsed && "justify-center px-0")}
      markClassName="size-8 rounded-md bg-card ring-1 ring-border"
    />
  );
}

const NAV_ROW_ACTIVE_CLASS =
  "relative data-[active=true]:font-semibold data-[active=true]:before:absolute data-[active=true]:before:inset-y-2 data-[active=true]:before:left-0 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-[var(--prism-portal-current)]";

type NavRowProps = { item: PrismNavItem; activeId: string; onSelect: (id: string) => void };

/** A plain destination: a real link so it opens in a new tab, with client-side navigation on a plain click. */
function NavLinkRow({ item, activeId, onSelect }: NavRowProps) {
  const current = item.id === activeId;
  return (
    <SidebarMenuButton asChild className={NAV_ROW_ACTIVE_CLASS} isActive={current} tooltip={item.label}>
      <a data-nav-id={item.id} href={portalHref(item.href ?? "")} aria-current={current ? "page" : undefined} onClick={(event) => navLinkClick(event, () => onSelect(item.id))}>
        <item.icon aria-hidden="true" />
        <span>{item.label}</span>
      </a>
    </SidebarMenuButton>
  );
}

/**
 * Class changes when a portal opts into the phone bar: the menu button and search give way to the tabs and the phone
 * top bar, the page heading tightens, the content clears the tab bar, and desktop's top bar actions give way to the phone's.
 */
function phoneLayout(tabs: boolean) {
  return {
    trigger: tabs ? "hidden md:inline-flex" : undefined,
    // The top bar names the page, so the page keeps its own name, a size smaller; the line under it is desktop's.
    title: tabs ? "mb-3 md:mb-5" : undefined,
    heading: tabs ? "text-xl md:text-2xl" : "text-2xl",
    description: tabs ? "hidden md:block" : undefined,
    content: tabs ? "pt-4 pb-28 md:pt-6 md:pb-6" : undefined,
    search: tabs ? "hidden md:flex" : "flex",
    headerActions: (alwaysShow: boolean) => (alwaysShow && !tabs ? "flex" : "hidden md:flex"),
  };
}

/** The phone top bar: the page (or the portal's own title control), then its icons and the account menu. */
function PhoneTopBar({ bar, title, fallback, actions, activeId, onSelect, user, accountMenuItems, onSignOut }: {
  bar?: ResolvedMobileBar;
  title?: React.ReactNode;
  fallback: string;
  actions?: React.ReactNode;
  activeId: string;
  onSelect: (id: string) => void;
} & Pick<PrismAppShellProps, "user" | "accountMenuItems" | "onSignOut">) {
  if (!bar) return <p className="min-w-0 truncate text-sm font-semibold text-foreground md:hidden">{fallback}</p>;
  return (
    <>
      <div className="min-w-0 flex-1 md:hidden">{title ?? <p className="truncate text-sm font-semibold text-foreground">{fallback}</p>}</div>
      <div className="-mr-2 flex shrink-0 items-center md:hidden">
        {actions}
        <PhoneHeaderIcons items={bar.header} activeId={activeId} onSelect={onSelect} />
        {user ? <PhoneAccountMenu user={user} items={accountMenuItems} onSignOut={onSignOut} /> : null}
      </div>
    </>
  );
}

/** A group with sub-destinations, or a destination the portal resolves itself: a button. */
function NavButtonRow({ item, activeId, onSelect, open, setOpen }: NavRowProps & { open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>> }) {
  const hasSub = Boolean(item.subItems?.length);
  return (
    <SidebarMenuButton
      data-nav-id={item.id}
      className={NAV_ROW_ACTIVE_CLASS}
      isActive={item.id === activeId || (isItemActive(item, activeId) && !open)}
      tooltip={item.label}
      disabled={item.disabled}
      aria-expanded={hasSub ? open : undefined}
      onClick={() => {
        onSelect(item.id);
        if (hasSub) setOpen((value) => !value || item.id !== activeId);
      }}
    >
      <item.icon aria-hidden="true" />
      <span>{item.label}</span>
      {hasSub ? <ChevronRight aria-hidden="true" className={cn("ml-auto size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} /> : null}
    </SidebarMenuButton>
  );
}

function NavItemRow({ item, activeId, onSelect }: NavRowProps) {
  const { isMobile, setOpenMobile } = useSidebar();
  const active = isItemActive(item, activeId);
  const [open, setOpen] = React.useState(active);
  const selectAndClose = React.useCallback((id: string) => {
    onSelect(id);
    if (isMobile) setOpenMobile(false);
  }, [isMobile, onSelect, setOpenMobile]);
  React.useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  const hasSub = Boolean(item.subItems?.length);
  const asLink = Boolean(item.href) && !hasSub && !item.disabled;
  return (
    <SidebarMenuItem>
      {asLink ? (
        <NavLinkRow item={item} activeId={activeId} onSelect={selectAndClose} />
      ) : (
        <NavButtonRow item={item} activeId={activeId} onSelect={hasSub ? onSelect : selectAndClose} open={open} setOpen={setOpen} />
      )}
      {hasBadge(item.badge) && !hasSub ? <SidebarMenuBadge aria-label={item.badgeLabel}>{item.badge}</SidebarMenuBadge> : null}
      {hasSub && open ? <NavSubItems items={item.subItems ?? []} activeId={activeId} onSelect={selectAndClose} /> : null}
    </SidebarMenuItem>
  );
}

function NavSubItems({ items, activeId, onSelect }: { items: NonNullable<PrismNavItem["subItems"]>; activeId: string; onSelect: (id: string) => void }) {
  return (
    <SidebarMenuSub>
      {items.map((sub) => (
        <SidebarMenuSubItem key={sub.id}>
          <SidebarMenuSubButton asChild isActive={sub.id === activeId}>
            {sub.href && !sub.disabled ? (
              <a data-nav-id={sub.id} href={portalHref(sub.href)} aria-current={sub.id === activeId ? "page" : undefined} onClick={(event) => navLinkClick(event, () => onSelect(sub.id))} className="w-full">
                <span>{sub.label}</span>
                {hasBadge(sub.badge) ? <span className="ml-auto tabular-nums text-muted-foreground">{sub.badge}</span> : null}
              </a>
            ) : (
              <button data-nav-id={sub.id} type="button" disabled={sub.disabled} onClick={() => onSelect(sub.id)} className="w-full">
                <span>{sub.label}</span>
                {hasBadge(sub.badge) ? <span className="ml-auto tabular-nums text-muted-foreground">{sub.badge}</span> : null}
              </button>
            )}
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );
}

function AccountMenu({ user, items, onSignOut }: Pick<PrismAppShellProps, "user" | "onSignOut"> & { items?: PrismAppShellProps["accountMenuItems"] }) {
  const { isMobile } = useSidebar();
  if (!user) return null;
  const initials = initialsFor(user.name, user.initials);
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={user.name}>
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-md bg-ink text-xs font-semibold text-white">
                {initials}
              </span>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold text-foreground">{user.name}</span>
                {user.detail ? <span className="truncate text-xs text-muted-foreground">{user.detail}</span> : null}
              </span>
              <ChevronsUpDown aria-hidden="true" className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? "top" : "right"} align="end" sideOffset={8} className="w-60">
            <AccountMenuEntries user={user} items={items} onSignOut={onSignOut} />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function PaletteAction({ action, onChoose }: { action: PrismPageAction; onChoose: (action: PrismPageAction) => void }) {
  return (
    <CommandItem
      value={`${action.label} ${action.description ?? ""}`}
      disabled={action.disabled}
      onSelect={() => onChoose(action)}
    >
      {action.icon ? <action.icon aria-hidden="true" /> : null}
      <span className="truncate">{action.label}</span>
      {action.description ? <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">{action.description}</span> : null}
      {action.status ? <span className="ml-auto shrink-0 pl-3 text-xs text-muted-foreground">{action.status}</span> : null}
    </CommandItem>
  );
}

function PageSearch({
  navItems,
  actions,
  actionsLabel,
  groups = [],
  groupsLoading = false,
  emptyLabel = "Nothing matches.",
  placeholder,
  onOpen,
  onSelect,
}: {
  navItems: PrismNavItem[];
  actions: NonNullable<PrismAppShellProps["commandActions"]>;
  actionsLabel?: string;
  groups?: PrismCommandGroup[];
  groupsLoading?: boolean;
  emptyLabel?: string;
  placeholder: string;
  onOpen?: () => void;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const searching = query.trim().length > 0;
  const visibleGroups = groups.filter((group) => searching || !group.whenSearching);
  const onOpenRef = React.useRef(onOpen);
  React.useEffect(() => {
    onOpenRef.current = onOpen;
  });
  React.useEffect(() => {
    if (open) onOpenRef.current?.();
  }, [open]);
  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const go = (id: string) => {
    setOpen(false);
    onSelect(id);
  };
  const choose = (action: PrismPageAction) => {
    setOpen(false);
    action.onSelect?.();
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={placeholder}
        className="flex size-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-background text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground sm:h-9 sm:w-full sm:max-w-72 sm:justify-start sm:px-3"
      >
        <Search aria-hidden="true" className="size-4" />
        <span className="hidden flex-1 truncate text-left sm:block">{placeholder}</span>
        <kbd className="hidden rounded border border-border px-1.5 text-xs text-muted-foreground sm:inline">Ctrl K</kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        title="Go to"
        description="Search events, clients, inquiries, pages and actions"
        filter={substringCommandFilter}
      >
        <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
        <CommandList>
          {groupsLoading ? <p role="status" className="px-2 py-6 text-center text-sm text-muted-foreground">Loading events and clients…</p> : <CommandEmpty>{emptyLabel}</CommandEmpty>}
          {groupNav(navItems).map((group) => (
            <CommandGroup key={group.label} heading={group.label}>
              {group.items.flatMap((item) => [
                <CommandItem key={item.id} value={`${item.label} ${item.id}`} disabled={item.disabled} onSelect={() => go(item.id)}>
                  <item.icon aria-hidden="true" />
                  {item.label}
                </CommandItem>,
                ...(item.subItems ?? []).map((sub) => (
                  <CommandItem key={sub.id} value={`${item.label} ${sub.label} ${sub.id}`} disabled={sub.disabled} onSelect={() => go(sub.id)}>
                    <span className="pl-6">{sub.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{item.label}</span>
                  </CommandItem>
                )),
              ])}
            </CommandGroup>
          ))}
          {visibleGroups.map((group) => (
            <CommandGroup key={group.heading} heading={group.heading}>
              {group.actions.map((action) => (
                <PaletteAction key={action.id} action={action} onChoose={choose} />
              ))}
            </CommandGroup>
          ))}
          {actions.length ? (
            <CommandGroup heading={actionsLabel ?? "Actions"}>
              {actions.map((action) => (
                <PaletteAction key={action.id} action={action} onChoose={choose} />
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}

export interface PrismPortalShellProps extends PrismAppShellProps {
  portal: PrismPortal;
}

/** The signed-in frame for every portal: sidebar navigation, top bar, and the page header above the content. */
export function PrismPortalShell({
  portal,
  productLabel = "P.R.I.S.M.",
  roleLabel,
  title,
  description,
  activeItemId = "",
  breadcrumb,
  navItems,
  onNavSelect,
  user,
  searchPlaceholder = "Search pages",
  showTopBarSearch = true,
  commandActions = [],
  commandSectionLabel,
  commandGroups,
  commandEmptyLabel,
  commandGroupsLoading,
  onCommandPaletteOpen,
  headerActions,
  alwaysShowHeaderActions = false,
  mobileBar,
  mobileTitle,
  mobileHeaderActions,
  sidebarContext,
  accountMenuItems,
  onSignOut,
  children,
  className,
  contentClassName,
  titleClassName,
  homeHref = "/dashboard",
}: PrismPortalShellProps) {
  const select = React.useCallback((id: string) => onNavSelect?.(id), [onNavSelect]);
  const trail = breadcrumb ?? findTrail(navItems, activeItemId);
  const phoneBar = mobileBar ? resolveMobileBar(mobileBar, navItems) : undefined;
  const phone = phoneLayout(Boolean(phoneBar));
  useDocumentTitle(title ? `${title} · ${productLabel}` : undefined);
  return (
    <TooltipProvider delayDuration={300}>
      <SidebarProvider className={cn("prism-shell", className)} data-portal={portal}>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader>
            <SidebarBrand href={homeHref} title={productLabel} detail={roleLabel} />
            {sidebarContext ? <div className="group-data-[collapsible=icon]:hidden">{sidebarContext}</div> : null}
          </SidebarHeader>
          <SidebarContent>
            {groupNav(navItems).map((group) => (
              <SidebarGroup key={group.label}>
                {group.label.toLowerCase() === roleLabel.toLowerCase() ? null : <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
                <SidebarMenu>
                  {group.items.map((item) => (
                    <NavItemRow key={item.id} item={item} activeId={activeItemId} onSelect={select} />
                  ))}
                </SidebarMenu>
              </SidebarGroup>
            ))}
          </SidebarContent>
          <SidebarFooter>
            <AccountMenu user={user} items={accountMenuItems} onSignOut={onSignOut} />
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset style={portalBackgroundStyle} className="min-w-0 md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:border-border md:peer-data-[variant=inset]:shadow-none">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
            <SidebarTrigger className={cn("-ml-1.5", phone.trigger)} />
            <Separator orientation="vertical" className="hidden !h-4 sm:block" />
            <PhoneTopBar
              bar={phoneBar}
              title={mobileTitle}
              fallback={trail[trail.length - 1] ?? roleLabel}
              actions={mobileHeaderActions}
              activeId={activeItemId}
              onSelect={select}
              user={user}
              accountMenuItems={accountMenuItems}
              onSignOut={onSignOut}
            />
            <Breadcrumb className="hidden min-w-0 flex-1 overflow-hidden md:block">
              <BreadcrumbList className="flex-nowrap">
                {/* On a tablet the sidebar already names the portal, so the page name gets the room. */}
                <BreadcrumbItem className={cn("shrink-0 whitespace-nowrap text-muted-foreground", trail.length ? "hidden lg:inline-flex" : "inline-flex")}>{roleLabel}</BreadcrumbItem>
                {trail.map((label, index) => (
                  <React.Fragment key={label}>
                    <BreadcrumbSeparator className={index === 0 ? "hidden lg:block" : undefined} />
                    <BreadcrumbItem className="min-w-0">
                      {index === trail.length - 1 ? <BreadcrumbPage className="truncate">{label}</BreadcrumbPage> : <TruncatedText className="min-w-0 max-w-64">{label}</TruncatedText>}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-2">
              <SpotifyMusicControl />
              {showTopBarSearch ? (
                <div className={phone.search}><PageSearch
                  navItems={navItems}
                  actions={commandActions}
                  actionsLabel={commandSectionLabel}
                  groups={commandGroups}
                  groupsLoading={commandGroupsLoading}
                  emptyLabel={commandEmptyLabel}
                  placeholder={searchPlaceholder}
                  onOpen={onCommandPaletteOpen}
                  onSelect={select}
                /></div>
              ) : null}
              {headerActions ? <div className={cn("shrink-0 items-center gap-2", phone.headerActions(alwaysShowHeaderActions))}>{headerActions}</div> : null}
            </div>
          </header>
          <div className={cn("mx-auto min-w-0 w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8", phone.content, contentClassName)}>
            {/* With phone tabs the top bar already names the page, so the heading shows from a tablet up. */}
            <div className={cn("mb-5 grid gap-1", phone.title, titleClassName)}>
              <h1 className={cn("min-w-0 font-heading font-semibold leading-tight text-foreground", phone.heading)}><TruncatedText>{title}</TruncatedText></h1>
              {description ? <p className={cn("max-w-3xl text-sm text-muted-foreground", phone.description)}>{description}</p> : null}
            </div>
            {children}
          </div>
          {phoneBar ? <PhoneTabBar bar={phoneBar} activeId={activeItemId} onSelect={select} /> : null}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
