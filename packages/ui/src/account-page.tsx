"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import type { PrismOwnSession, PrismOwnSignIn, PrismPendingEmailChange } from "@prism/types";
import { Button } from "./components/ui/button";
import { LoadingState } from "./components/ui/loading-state";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./components/ui/sheet";
import { NameEditor, PasswordChanger, SignInList, type AccountChange } from "./account-security";
import { SessionList, devicesValue } from "./account-sessions";
import { TwoStepPanel, type AccountTwoStepActions } from "./account-two-step";
import { EmailPanel, emailValue, type AccountEmailActions } from "./account-email";
import { formatPortalDate, formatPortalDateTime, manilaCalendarKey } from "./format-date";
import { cn } from "./utils";

export { accountChange } from "./account-security";

/** Who is signed in, as the account page heads with it. */
export type AccountIdentity = {
  name: string;
  email: string;
  organization: string;
  roleLabel: string;
  /** A change of sign-in email waiting for the link sent to the new address. */
  pendingEmail?: PrismPendingEmailChange | null;
};

/** The PMCM person a client or supplier talks to, with the way to message them. */
export type AccountContact = { name: string; detail: string; href: string };

/** A role's own place beyond the personal account: a supplier record, PMCM's workspace settings. */
export type AccountLink = { title: string; description: string; href: string };

/** A client's or supplier's privacy at a glance: open requests, the soonest due, and the notice they accepted. */
export type AccountPrivacySummary = {
  openCount: number;
  nextDueAt: string | null;
  notice: { version: string | null; acknowledgedAt: string | null };
  href: string;
};

/** What the signed-in person can change about their own account; absent where a portal does not offer it. */
export type AccountActions = {
  saveName?: AccountChange<{ name: string }>;
  /** Resolves null once changed; the portal then signs the person out, since every session ended. */
  changePassword?: AccountChange<{ currentPassword: string; newPassword: string }>;
  /** Signs out one other browser, by its session id. */
  signOutSession?: AccountChange<string>;
  /** Signs out every browser but this one. */
  signOutOtherSessions?: AccountChange<void>;
  /** Turns two-step sign-in on or off. */
  twoStep?: AccountTwoStepActions;
  /** Changes the sign-in email through a link sent to the new address. */
  changeEmail?: AccountEmailActions;
};

export type AccountSecuritySummary = {
  /** When this sign-in happened. */
  signedInAt: string | null;
  twoFactorEnabled: boolean;
  /** Two-step sign-in cannot be turned off for this role (PMCM staff). */
  twoFactorRequired: boolean;
};

type Panel = "name" | "email" | "password" | "two-step" | "devices" | "sign-ins" | "notifications";

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";

/**
 * Failed sign-ins since the person's last visit: those after the sign-in before this one. The list is newest first,
 * and this visit's sign-in is the first success in it.
 */
export function failedSinceLastVisit(signIns: PrismOwnSignIn[]): PrismOwnSignIn[] {
  const failed: PrismOwnSignIn[] = [];
  let successes = 0;
  for (const signIn of signIns) {
    if (signIn.succeeded) successes += 1;
    else failed.push(signIn);
    if (successes === 2) break;
  }
  return failed;
}

/** One setting: its name, its value now, and either a chevron that opens it, a link, or its own button. */
function Row({ label, value, onOpen, href, action }: { label: string; value: string; onOpen?: () => void; href?: string; action?: ReactNode }) {
  const name = `${label}: ${value}`;
  // On a phone the value sits under its label, so it has the full width instead of a squeezed column.
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="shrink-0 text-sm text-foreground sm:w-44">{label}</span>
        <span className="min-w-0 flex-1 text-sm text-muted-foreground sm:truncate">{value}</span>
      </span>
      {action ?? (onOpen || href ? <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null)}
    </>
  );
  const rowClass = "flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left";
  if (onOpen) return <li><button type="button" onClick={onOpen} aria-haspopup="dialog" aria-label={name} className={cn(rowClass, "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring")}>{body}</button></li>;
  if (href) return <li><a href={href} aria-label={name} className={cn(rowClass, "hover:bg-muted/40")}>{body}</a></li>;
  return <li className={rowClass}>{body}</li>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0 space-y-1.5">
      <h2 className="px-1 text-xs font-semibold text-muted-foreground">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">{children}</ul>
    </section>
  );
}

function FailedSignInBanner({ failed, onReview }: { failed: PrismOwnSignIn[]; onReview: () => void }) {
  if (failed.length === 0) return null;
  const latest = failed[0];
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-attention/30 bg-attention-soft px-4 py-3">
      <AlertTriangle aria-hidden className="size-5 shrink-0 text-attention" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-foreground">{failed.length === 1 ? "1 failed sign-in" : `${failed.length} failed sign-ins`} since your last visit</p>
        <p className="text-xs text-muted-foreground">{formatPortalDateTime(latest.at)} · {latest.device}. If it was not you, change your password.</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onReview}>Review</Button>
    </div>
  );
}

function twoStepValue(security: AccountSecuritySummary) {
  if (!security.twoFactorEnabled) return "Off";
  return security.twoFactorRequired ? "On, required for PMCM staff" : "On";
}

function latestSignIn(signIns: PrismOwnSignIn[] | null, security: AccountSecuritySummary) {
  const latest = signIns?.find((signIn) => signIn.succeeded);
  if (latest) return `${latest.device} · ${formatPortalDateTime(latest.at)}`;
  return security.signedInAt ? formatPortalDateTime(security.signedInAt) : "Not recorded";
}

function SecurityGroup({ security, actions, signIns, sessions, open }: {
  security: AccountSecuritySummary;
  actions: AccountActions;
  signIns: PrismOwnSignIn[] | null;
  sessions: PrismOwnSession[] | null;
  open: (panel: Panel) => void;
}) {
  return (
    <Group title="Sign-in and security">
      {actions.changePassword ? <Row label="Password" value="Change it any time" onOpen={() => open("password")} /> : null}
      <Row label="Two-step sign-in" value={twoStepValue(security)} onOpen={actions.twoStep ? () => open("two-step") : undefined} />
      {sessions ? <Row label="Devices" value={devicesValue(sessions)} onOpen={() => open("devices")} /> : null}
      <Row label="Recent sign-ins" value={latestSignIn(signIns, security)} onOpen={signIns ? () => open("sign-ins") : undefined} />
    </Group>
  );
}

/** A notice version is its publication date (2026-10-25); anything else is shown as written. */
const noticeName = (version: string) => (/^\d{4}-\d{2}-\d{2}$/.test(version) ? `notice of ${formatPortalDate(version)}` : `notice ${version}`);

function privacyValue(privacy: AccountPrivacySummary) {
  if (privacy.openCount === 0) {
    const { version, acknowledgedAt } = privacy.notice;
    return version && acknowledgedAt ? `No open requests · accepted the ${noticeName(version)}` : "No open requests";
  }
  const due = privacy.nextDueAt ? ` · next due ${formatPortalDate(manilaCalendarKey(privacy.nextDueAt))}` : "";
  return `${privacy.openCount} open ${privacy.openCount === 1 ? "request" : "requests"}${due}`;
}

function HelpGroup({ contact, privacy, links }: { contact: AccountContact | null; privacy: AccountPrivacySummary | null; links: AccountLink[] }) {
  if (!contact && !privacy && links.length === 0) return null;
  return (
    <Group title="Help and privacy">
      {contact ? (
        <Row label="Your PMCM contact" value={`${contact.name} · ${contact.detail}`}
          action={<a href={contact.href} className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted">Message</a>} />
      ) : null}
      {privacy ? <Row label="Privacy" value={privacyValue(privacy)} href={privacy.href} /> : null}
      {links.map((link) => <Row key={link.href} label={link.title} value={link.description} href={link.href} />)}
    </Group>
  );
}

const PANEL_TITLES: Record<Panel, { title: string; description: string }> = {
  name: { title: "Your name", description: "How PMCM and your events show you." },
  email: { title: "Sign-in email", description: "The address you sign in with and where PMCM emails you." },
  password: { title: "Change your password", description: "This signs you out everywhere, including here. You sign in again with the new one." },
  "two-step": { title: "Two-step sign-in", description: "A code from your phone after your password, so a password alone is not enough to sign in as you." },
  devices: { title: "Where you're signed in", description: "Sign out any device you no longer use or don't recognise. To sign out here, use Sign out in the menu." },
  "sign-ins": { title: "Recent sign-ins", description: "Your last 10. Anything you don't recognise? Change your password." },
  notifications: { title: "Notifications", description: "How PMCM reaches you." },
};

type PanelProps = {
  panel: Panel | null;
  identity: AccountIdentity | null;
  security: AccountSecuritySummary | null;
  actions: AccountActions;
  signIns: PrismOwnSignIn[] | null;
  sessions: PrismOwnSession[] | null;
  notifications: ReactNode;
  onPanel: (panel: Panel | null) => void;
  onSaved: (note: string) => void;
};

/** What each panel holds; null when the portal did not pass what it needs. */
const PANEL_BODIES: Record<Panel, (props: PanelProps) => ReactNode> = {
  name: ({ identity, actions, onPanel, onSaved }) => identity && actions.saveName ? (
    <NameEditor name={identity.name} save={actions.saveName} onDone={() => onPanel(null)} onSaved={() => onSaved("Name saved. The menu shows it after your next sign-in.")} />
  ) : null,
  email: ({ identity, actions, onPanel, onSaved }) => identity && actions.changeEmail ? (
    <EmailPanel email={identity.email} pending={identity.pendingEmail ?? null} actions={actions.changeEmail} onDone={(note) => { onPanel(null); onSaved(note); }} />
  ) : null,
  password: ({ actions, onPanel }) => actions.changePassword ? <PasswordChanger change={actions.changePassword} onCancel={() => onPanel(null)} /> : null,
  "two-step": ({ security, actions, onPanel, onSaved }) => security && actions.twoStep ? (
    <TwoStepPanel enabled={security.twoFactorEnabled} required={security.twoFactorRequired} actions={actions.twoStep}
      onDone={(note) => { onPanel(null); onSaved(note); }} />
  ) : null,
  devices: ({ sessions, actions }) => sessions ? <SessionList sessions={sessions} signOut={actions.signOutSession} signOutOthers={actions.signOutOtherSessions} /> : null,
  "sign-ins": ({ signIns, actions, onPanel }) => signIns ? (
    <div className="space-y-3">
      <SignInList signIns={signIns} />
      {actions.changePassword ? <Button type="button" variant="outline" size="sm" onClick={() => onPanel("password")}>Change password</Button> : null}
    </div>
  ) : null,
  notifications: ({ notifications }) => notifications,
};

/** The one task a row opens, in a side panel that fills the screen on phones. Panels can hand off to each other. */
function AccountPanel(props: PanelProps) {
  const { panel, onPanel } = props;
  return (
    <Sheet open={panel !== null} onOpenChange={(next) => { if (!next) onPanel(null); }}>
      {panel ? (
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b border-border pr-12">
            <SheetTitle>{PANEL_TITLES[panel].title}</SheetTitle>
            <SheetDescription>{PANEL_TITLES[panel].description}</SheetDescription>
          </SheetHeader>
          <div className="p-4">{PANEL_BODIES[panel](props)}</div>
        </SheetContent>
      ) : null}
    </Sheet>
  );
}

/**
 * The signed-in person's own account, the same on every portal. At first glance it answers one question, whether
 * anything needs them (a banner only then), and lists each setting as a row with its value now. A row opens its one
 * task in a side panel; nothing is edited in place. Role-neutral: portals pass their own data and panels.
 */
export function AccountScreen({ identity, loading, error, security, notifications, privacy, contact, links, actions = {}, signIns = null, sessions = null }: {
  identity: AccountIdentity | null;
  loading: boolean;
  error: string | null;
  security: AccountSecuritySummary | null;
  /** The portal's notification channel settings, opened from the Notifications row. */
  notifications: ReactNode;
  privacy: AccountPrivacySummary | null;
  contact: AccountContact | null;
  links: AccountLink[];
  today?: string;
  /** What the person can change; each portal wires its own API calls. */
  actions?: AccountActions;
  /** Their own latest sign-ins, once loaded. */
  signIns?: PrismOwnSignIn[] | null;
  /** The browsers they are signed in on now, once loaded. */
  sessions?: PrismOwnSession[] | null;
}) {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="max-w-3xl space-y-4">
      {loading ? <LoadingState label="Loading your account…" /> : null}
      {error ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      {identity ? (
        <header className="flex items-center gap-3">
          <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink text-sm font-semibold text-white">{initialsOf(identity.name)}</span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-foreground">{identity.name}</p>
            <p className="break-words text-sm text-muted-foreground">{[identity.email, identity.organization, identity.roleLabel].filter(Boolean).join(" · ")}</p>
          </div>
        </header>
      ) : null}
      {note ? <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">{note}</p> : null}
      {signIns ? <FailedSignInBanner failed={failedSinceLastVisit(signIns)} onReview={() => setPanel("sign-ins")} /> : null}
      {identity ? (
        <Group title="You">
          <Row label="Name" value={identity.name} onOpen={actions.saveName ? () => setPanel("name") : undefined} />
          <Row label="Email" value={emailValue(identity.email, identity.pendingEmail)} onOpen={actions.changeEmail ? () => setPanel("email") : undefined} />
        </Group>
      ) : null}
      {security ? <SecurityGroup security={security} actions={actions} signIns={signIns} sessions={sessions} open={setPanel} /> : null}
      <Group title="Notifications">
        <Row label="Channels" value="Email and Viber" onOpen={() => setPanel("notifications")} />
      </Group>
      <HelpGroup contact={contact} privacy={privacy} links={links} />
      <AccountPanel panel={panel} identity={identity} security={security} actions={actions} signIns={signIns} sessions={sessions} notifications={notifications} onPanel={setPanel} onSaved={setNote} />
    </div>
  );
}
