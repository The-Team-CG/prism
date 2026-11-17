"use client";

import { useState, type ReactNode } from "react";
import type { PrismOwnSignIn } from "@prism/types";
import { Button } from "./components/ui/button";
import { NameEditor, PasswordChanger, SignInList, type AccountChange } from "./account-security";
export { accountChange } from "./account-security";
import { ChevronRight, KeyRound, MessageSquare, ShieldCheck } from "lucide-react";
import { LoadingState } from "./components/ui/loading-state";
import { formatPortalDate, formatPortalDateTime, manilaCalendarKey } from "./format-date";
import { PrivacyDuePill } from "./privacy-requests";
import { cn } from "./utils";

/** Who is signed in, as the account page heads with it. */
export type AccountIdentity = { name: string; email: string; organization: string; roleLabel: string };

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
};

export type AccountSecuritySummary = {
  /** When this sign-in happened. */
  signedInAt: string | null;
  twoFactorEnabled: boolean;
  /** Two-step sign-in cannot be turned off for this role (PMCM staff). */
  twoFactorRequired: boolean;
};

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";

function Card({ title, icon: Icon, children, className }: { title: string; icon?: typeof ShieldCheck; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cn("min-w-0 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5", className)}>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">{Icon ? <Icon aria-hidden className="size-4 text-muted-foreground" /> : null}{title}</h2>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm first:pt-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}

function SecurityCard({ security, changePassword, signIns }: { security: AccountSecuritySummary; changePassword?: AccountActions["changePassword"]; signIns: PrismOwnSignIn[] | null }) {
  const [changing, setChanging] = useState(false);
  const twoStep = security.twoFactorEnabled ? (security.twoFactorRequired ? "On (required for PMCM staff)" : "On") : "Off";
  return (
    <Card title="Sign-in and security" icon={KeyRound}>
      <dl className="divide-y divide-border">
        <Fact label="This sign-in">{security.signedInAt ? formatPortalDateTime(security.signedInAt) : "Not recorded"}</Fact>
        <Fact label="Two-step sign-in"><span className={cn("font-medium", security.twoFactorEnabled ? "text-success" : "text-muted-foreground")}>{twoStep}</span></Fact>
        {changePassword ? (
          <Fact label="Password">{changing ? null : <Button type="button" variant="link" size="sm" className="h-auto px-0 text-primary" onClick={() => setChanging(true)}>Change</Button>}</Fact>
        ) : null}
      </dl>
      {changePassword && changing ? <PasswordChanger change={changePassword} onCancel={() => setChanging(false)} /> : null}
      {signIns ? (
        <div className="mt-3 border-t border-border pt-3">
          <h3 className="mb-1 text-xs font-medium text-muted-foreground">Recent sign-ins</h3>
          <SignInList signIns={signIns} />
        </div>
      ) : null}
    </Card>
  );
}

function IdentityHeader({ identity, saveName }: { identity: AccountIdentity; saveName?: AccountActions["saveName"] }) {
  const [editing, setEditing] = useState(false);
  return (
    <header className="flex flex-wrap items-center gap-3">
      <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink text-sm font-semibold text-white">{initialsOf(identity.name)}</span>
      {editing && saveName ? <NameEditor name={identity.name} save={saveName} onDone={() => setEditing(false)} /> : (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-foreground">{identity.name}</p>
            <p className="break-words text-sm text-muted-foreground">{[identity.email, identity.organization, identity.roleLabel].filter(Boolean).join(" · ")}</p>
          </div>
          {saveName ? <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>Edit name</Button> : null}
        </>
      )}
    </header>
  );
}

function ContactCard({ contact }: { contact: AccountContact }) {
  return (
    <Card title="Your PMCM contact" icon={MessageSquare}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">{initialsOf(contact.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{contact.name}</p>
          <p className="truncate text-xs text-muted-foreground">{contact.detail}</p>
        </div>
        <a href={contact.href} className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-muted">Message</a>
      </div>
    </Card>
  );
}

/** A notice version is its publication date (2026-10-25); anything else is shown as written. */
const noticeName = (version: string) => (/^\d{4}-\d{2}-\d{2}$/.test(version) ? `notice of ${formatPortalDate(version)}` : `notice ${version}`);

function PrivacyCard({ privacy, today }: { privacy: AccountPrivacySummary; today: string }) {
  const { version, acknowledgedAt } = privacy.notice;
  return (
    <Card title="Privacy" icon={ShieldCheck}>
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-foreground">{privacy.openCount === 0 ? "No open requests" : `${privacy.openCount} open ${privacy.openCount === 1 ? "request" : "requests"}`}</span>
          {privacy.nextDueAt ? <PrivacyDuePill dueAt={privacy.nextDueAt} today={today} /> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {version && acknowledgedAt ? `You accepted the privacy ${noticeName(version)} on ${formatPortalDate(manilaCalendarKey(acknowledgedAt))}.` : "PMCM's privacy notice applies to your account."}
        </p>
        <a href={privacy.href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Open Privacy<ChevronRight aria-hidden className="size-4" /></a>
      </div>
    </Card>
  );
}

function LinksCard({ links }: { links: AccountLink[] }) {
  return (
    <Card title="More for your role">
      <ul className="divide-y divide-border">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} className="flex items-center gap-3 py-2.5 hover:text-primary">
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-foreground">{link.title}</span><span className="block text-xs text-muted-foreground">{link.description}</span></span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * The signed-in person's own account, the same on every portal: who they are, how they sign in, their notification
 * channels, and, where their role has them, their PMCM contact, privacy and role links. Role-neutral: portals pass
 * their own data and panels.
 */
export function AccountScreen({ identity, loading, error, security, notifications, privacy, contact, links, today, actions = {}, signIns = null }: {
  identity: AccountIdentity | null;
  /** What the person can change; each portal wires its own API calls. */
  actions?: AccountActions;
  /** Their own latest sign-ins, once loaded. */
  signIns?: PrismOwnSignIn[] | null;
  loading: boolean;
  error: string | null;
  security: AccountSecuritySummary | null;
  /** The portal's notification channel settings, shown in place. */
  notifications: ReactNode;
  privacy: AccountPrivacySummary | null;
  contact: AccountContact | null;
  links: AccountLink[];
  today: string;
}) {
  return (
    <div className="space-y-4">
      {loading ? <LoadingState label="Loading your account…" /> : null}
      {error ? <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p> : null}
      {identity ? <IdentityHeader identity={identity} saveName={actions.saveName} /> : null}
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
        {security ? <SecurityCard security={security} changePassword={actions.changePassword} signIns={signIns} /> : null}
        {contact || privacy ? (
          <div className="grid min-w-0 gap-4">
            {contact ? <ContactCard contact={contact} /> : null}
            {privacy ? <PrivacyCard privacy={privacy} today={today} /> : null}
          </div>
        ) : null}
      </div>
      <div id="notification-settings" className="scroll-mt-6">{notifications}</div>
      {links.length ? <LinksCard links={links} /> : null}
    </div>
  );
}
