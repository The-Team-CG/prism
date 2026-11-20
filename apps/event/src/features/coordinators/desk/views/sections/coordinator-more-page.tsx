"use client";

import type { ReactNode } from "react";
import { Bell, CalendarDays, ChevronRight, ClipboardCheck, ClipboardPlus, LogOut, MessageSquare, Phone, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { Button } from "@prism/ui/components/button";
import { PrismSection } from "@prism/ui/page-blocks";
import { pmcmSupportContactFromEnvironment } from "@/lib/portal-urls";
import type { CoordinatorViewId } from "../../model/coordinator-portal-routes";

type MoreLink = { id: string; label: string; icon: LucideIcon; badge?: number; onSelect: () => void };

function LinkRow({ link }: { link: MoreLink }) {
  return (
    <li>
      <button type="button" onClick={link.onSelect} className="flex min-h-13 w-full items-center gap-3 px-4 py-3 text-left text-[15px] text-foreground hover:bg-surface-raised sm:px-5">
        <link.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">{link.label}</span>
        {link.badge ? <span className="rounded-full bg-danger px-2 text-xs font-semibold leading-5 text-white">{link.badge}</span> : null}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </li>
  );
}

/**
 * More, the phone's fifth tab: PMCM's contact first, the event switch, then everything used less often on site.
 * The four main tabs stay uncluttered because these live here.
 */
export function CoordinatorMorePage({ eventSwitcher, canLogTask, registrationRole, unreadMessages, unreadNotices, onNavigate, onLogTask, onSignOut }: {
  eventSwitcher: ReactNode;
  canLogTask: boolean;
  registrationRole: boolean;
  unreadMessages?: number;
  unreadNotices?: number;
  onNavigate: (view: CoordinatorViewId) => void;
  onLogTask: () => void;
  onSignOut?: () => void;
}) {
  const { phone } = pmcmSupportContactFromEnvironment();
  const links: MoreLink[] = [
    ...(canLogTask ? [{ id: "log-task", label: "Log a task", icon: ClipboardPlus, onSelect: onLogTask }] : []),
    ...(registrationRole ? [{ id: "registration", label: "Registration desk", icon: ClipboardCheck, onSelect: () => onNavigate("registration") }] : []),
    { id: "messages", label: "Messages", icon: MessageSquare, badge: unreadMessages, onSelect: () => onNavigate("messages") },
    { id: "notifications", label: "Notifications", icon: Bell, badge: unreadNotices, onSelect: () => onNavigate("notifications") },
    { id: "calendar", label: "Calendar", icon: CalendarDays, onSelect: () => onNavigate("calendar") },
    { id: "assignments", label: "My assignments", icon: UsersRound, onSelect: () => onNavigate("assignments") },
    { id: "account", label: "Account", icon: UserRound, onSelect: () => onNavigate("account") },
  ];
  return (
    <div className="grid w-full max-w-3xl gap-4">
      <PrismSection id="coordinator-more-pmcm" title="PMCM">
        <div className={phone ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
          {phone ? <Button asChild className="min-h-12"><a href={`tel:${phone.replace(/\s+/g, "")}`}><Phone className="size-4" aria-hidden />Call PMCM</a></Button> : null}
          <Button type="button" variant="outline" className="min-h-12" onClick={() => onNavigate("messages")}><MessageSquare className="size-4" aria-hidden />Message PMCM</Button>
        </div>
      </PrismSection>
      <PrismSection id="coordinator-more-event" title="Event">{eventSwitcher}</PrismSection>
      <PrismSection id="coordinator-more-links" title="Everything else" flush>
        <ul className="divide-y divide-border">{links.map((link) => <LinkRow key={link.id} link={link} />)}</ul>
      </PrismSection>
      {onSignOut ? <Button type="button" variant="ghost" className="min-h-12 justify-self-center text-muted-foreground" onClick={onSignOut}><LogOut className="size-4" aria-hidden />Sign out</Button> : null}
    </div>
  );
}
