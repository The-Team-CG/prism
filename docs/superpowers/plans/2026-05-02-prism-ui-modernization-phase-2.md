# Prism UI Modernization Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the next Prism UI modernization slice by making the client defense path and public entry points feel production-ready, then safely deepen the PMCM cockpit with shared Prism UI blocks.

**Architecture:** Keep `packages/ui` as a presentation-only package that receives plain props and callbacks. Keep API calls inside each portal, preserve role boundaries, and migrate repeated dashboard surfaces to shared Prism-owned shadcn-style blocks instead of copying CEDAR or adding registry blocks.

**Tech Stack:** Turborepo, Next.js, React 19, TypeScript, Tailwind v4, local `@prism/ui`, local `@prism/api-client`, shared NestJS API on port `4000`.

---

## Phase Scope

This phase follows the completed shared UI foundation slice. It should produce a visibly stronger defense-ready path without introducing external dependencies or backend contract changes.

In scope:
- Full client portal modernization for signed-conforme gate, briefing, official read-only floorplan, billing milestones, documents, and activity.
- Public landing and inquiry refresh using Prism-owned shared public blocks while preserving dashboard gating.
- PMCM selected-event cockpit polish using shared blocks where the change is low-risk.
- A repeatable frontend smoke script for public dashboard-link guards and local route checks.

Out of scope:
- Live AI, SendGrid, Viber, OAuth, QR scanning, file-storage provider, Canva, Zoom, ticketing, or external auth.
- Rebuilding the client app as an all-role shell.
- Moving official floorplan editing out of `apps/event`.
- Backend API expansion unless a compile break exposes a missing frontend type.

---

## File Structure

### Create

- `packages/ui/src/client-blocks.tsx`
  - Shared client-facing blocks for conforme state, briefing summary, official floorplan snapshot, activity timeline, and billing/document presentation.

- `packages/ui/src/public-blocks.tsx`
  - Shared public-page blocks for role cards, lifecycle strip, trust/operations highlights, and inquiry readiness panels.

- `scripts/smoke-prism-ui.mjs`
  - Local-only smoke script for route reachability and public dashboard-link regression guards.

### Modify

- `packages/ui/src/index.ts`
  - Export `client-blocks` and `public-blocks`.

- `packages/ui/package.json`
  - Add package export entries for `./client-blocks` and `./public-blocks`.

- `apps/client/src/app/components/dashboard/Dashboard.tsx`
  - Replace remaining local dense dashboard sections with shared client blocks while preserving current data mapping and floorplan boundaries.

- `apps/client/src/app/components/landing/MainLandingPage.tsx`
  - Refresh with shared public blocks and keep CTAs to inquiry/sign-in only.

- `apps/client/src/app/components/public-inquiry/PublicInquiryPage.tsx`
  - Improve inquiry form framing, privacy copy, state banners, and post-submit next-step clarity.

- `apps/supplier/src/app/page.tsx`
  - Apply shared public shell/blocks to supplier landing without adding dashboard links.

- `apps/guest/src/app/page.tsx`
  - Apply shared public shell/blocks to guest landing without allowing dashboard access without event code.

- `apps/event/src/app/page.tsx`
  - Tighten the selected-event cockpit header/action queue/right rail using existing shared blocks.

- `apps/event/src/app/components/pmcm/client-onboarding-tracker.tsx`
  - Use shared section panels, notices, and timeline treatment for inquiry/conforme/client unlock state.

- `apps/event/src/app/components/pmcm/financial-workspace.tsx`
  - Use shared billing milestone list and lighter section panels while preserving payment/dispute/waiver actions.

- `package.json`
  - Add `smoke:ui` script that runs `node scripts/smoke-prism-ui.mjs`.

---

## Task 1: Add Shared Client Blocks

**Files:**
- Create: `packages/ui/src/client-blocks.tsx`
- Modify: `packages/ui/src/index.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Create the client block interfaces and components**

Create `packages/ui/src/client-blocks.tsx` with presentation-only props. The file must not import app API clients, Next router, or app-local UI modules.

```tsx
"use client";

import type { ReactNode } from "react";
import { CalendarDays, CheckCircle2, FileText, LayoutPanelTop, LockKeyhole, ReceiptText } from "lucide-react";
import {
  PrismBadge,
  PrismButton,
  PrismCard,
  PrismCardContent,
  PrismCardHeader,
  PrismCardTitle,
  type PrismBadgeTone,
} from "./primitives";
import {
  PrismBillingMilestoneList,
  PrismDocumentList,
  PrismNoticeBanner,
  PrismSectionPanel,
  PrismStatusTimeline,
  type PrismBillingMilestone,
  type PrismDocumentItem,
  type PrismTimelineItem,
} from "./blocks";

export interface ClientConformeGateProps {
  status: "pending" | "signed" | "needs-review" | "locked";
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}

export interface ClientBriefingSummaryProps {
  eventName: string;
  eventDate: string;
  venue: string;
  guestCount: string;
  packageLabel: string;
  notes?: string;
}

export interface ClientOfficialFloorplanProps {
  status: "not-started" | "draft" | "submitted" | "approved";
  updatedAt?: string;
  summary: string;
  onOpen?: () => void;
}

export interface ClientDefenseWorkspaceProps {
  conforme: ClientConformeGateProps;
  briefing: ClientBriefingSummaryProps;
  floorplan: ClientOfficialFloorplanProps;
  billing: PrismBillingMilestone[];
  documents: PrismDocumentItem[];
  activity: PrismTimelineItem[];
}

const conformeTone: Record<ClientConformeGateProps["status"], PrismBadgeTone> = {
  pending: "warning",
  signed: "success",
  "needs-review": "info",
  locked: "neutral",
};

const conformeLabel: Record<ClientConformeGateProps["status"], string> = {
  pending: "Signature needed",
  signed: "Signed conforme",
  "needs-review": "PMCM review",
  locked: "Portal locked",
};

export function ClientConformeGate({ status, title, description, primaryAction, secondaryAction }: ClientConformeGateProps) {
  const Icon = status === "signed" ? CheckCircle2 : LockKeyhole;

  return (
    <PrismNoticeBanner
      tone={status === "signed" ? "success" : status === "pending" ? "warning" : "info"}
      title={title}
      description={description}
      icon={<Icon className="h-4 w-4" />}
      action={
        primaryAction || secondaryAction ? (
          <div className="flex flex-wrap gap-2">
            {primaryAction}
            {secondaryAction}
          </div>
        ) : null
      }
    />
  );
}

export function ClientBriefingSummary({ eventName, eventDate, venue, guestCount, packageLabel, notes }: ClientBriefingSummaryProps) {
  return (
    <PrismSectionPanel
      title="Event briefing"
      description="The confirmed details PMCM is using for planning."
      icon={<CalendarDays className="h-4 w-4" />}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          ["Event", eventName],
          ["Date", eventDate],
          ["Venue", venue],
          ["Guest count", guestCount],
          ["Package", packageLabel],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border/70 bg-muted/30 p-3">
            <p className="text-xs font-medium uppercase tracking-normal text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>
      {notes ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{notes}</p> : null}
    </PrismSectionPanel>
  );
}

export function ClientOfficialFloorplan({ status, updatedAt, summary, onOpen }: ClientOfficialFloorplanProps) {
  const label = status === "not-started" ? "Not prepared" : status === "draft" ? "PMCM draft" : status === "submitted" ? "Submitted" : "Approved";
  const tone: PrismBadgeTone = status === "approved" ? "success" : status === "submitted" ? "info" : status === "draft" ? "warning" : "neutral";

  return (
    <PrismCard>
      <PrismCardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <PrismCardTitle className="flex items-center gap-2">
              <LayoutPanelTop className="h-4 w-4 text-primary" />
              Official floorplan
            </PrismCardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Read-only client copy. PMCM owns editing and approval.</p>
          </div>
          <PrismBadge tone={tone}>{label}</PrismBadge>
        </div>
      </PrismCardHeader>
      <PrismCardContent>
        <p className="text-sm leading-6 text-muted-foreground">{summary}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{updatedAt ? `Updated ${updatedAt}` : "No official snapshot yet"}</span>
          {onOpen ? (
            <PrismButton type="button" size="sm" variant="outline" onClick={onOpen}>
              View read-only plan
            </PrismButton>
          ) : null}
        </div>
      </PrismCardContent>
    </PrismCard>
  );
}

export function ClientDefenseWorkspace({ conforme, briefing, floorplan, billing, documents, activity }: ClientDefenseWorkspaceProps) {
  return (
    <div className="space-y-5">
      <ClientConformeGate {...conforme} />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ClientBriefingSummary {...briefing} />
        <ClientOfficialFloorplan {...floorplan} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <PrismSectionPanel title="Billing milestones" description="Payment progress and PMCM-reviewed billing states" icon={<ReceiptText className="h-4 w-4" />}>
          <PrismBillingMilestoneList milestones={billing} />
        </PrismSectionPanel>
        <PrismSectionPanel title="Documents" description="Files and submissions tied to this confirmed event" icon={<FileText className="h-4 w-4" />}>
          <PrismDocumentList documents={documents} />
        </PrismSectionPanel>
      </div>
      <PrismSectionPanel title="Activity" description="Recent PMCM and client-facing updates">
        <PrismStatusTimeline items={activity} />
      </PrismSectionPanel>
    </div>
  );
}
```

- [ ] **Step 2: Export the client blocks**

Modify `packages/ui/src/index.ts`:

```ts
export * from "./client-blocks";
```

Modify `packages/ui/package.json` exports:

```json
"./client-blocks": "./src/client-blocks.tsx"
```

- [ ] **Step 3: Run the UI package typecheck**

Run:

```powershell
npm --workspace @prism/ui run typecheck
```

Expected:

```text
> @prism/ui@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```

---

## Task 2: Finish Client Dashboard Modernization

**Files:**
- Modify: `apps/client/src/app/components/dashboard/Dashboard.tsx`
- Optional modify: `apps/client/src/app/components/dashboard/dashboard-tabs.tsx` only if tab labels are duplicated in the main dashboard.

- [ ] **Step 1: Map current client data to shared block props**

Inside `Dashboard.tsx`, add adapter helpers near the existing dashboard-derived constants. Keep these helpers pure and local to the client app.

```tsx
const clientConformeStatus = currentEvent?.conformeSigned
  ? "signed"
  : currentEvent?.approvalStatus === "needs_review"
    ? "needs-review"
    : currentEvent
      ? "pending"
      : "locked";

const clientConforme = {
  status: clientConformeStatus,
  title: currentEvent?.conformeSigned ? "Your conforme is signed" : "Sign the conforme to unlock planning",
  description: currentEvent?.conformeSigned
    ? "PMCM can now proceed with planning, supplier coordination, billing, and official floorplan review."
    : "The client portal opens after PMCM accepts the inquiry and the conforme is signed.",
};
```

If the exact field names differ, use the existing `currentEvent`, `clientWorkspace`, `billing`, `documents`, and `activity` variables already available in `Dashboard.tsx`. Do not add a new API call.

- [ ] **Step 2: Replace the top confirmed-event content with `ClientDefenseWorkspace`**

Import:

```tsx
import { ClientDefenseWorkspace } from "@prism/ui/client-blocks";
```

Render it in the selected/confirmed event area:

```tsx
<ClientDefenseWorkspace
  conforme={clientConforme}
  briefing={{
    eventName: currentEvent?.eventName ?? "Confirmed event",
    eventDate: currentEvent?.eventDate ?? "Date to be confirmed",
    venue: currentEvent?.venue ?? "Venue to be confirmed",
    guestCount: currentEvent?.guestCount ? `${currentEvent.guestCount} guests` : "Guest count pending",
    packageLabel: currentEvent?.packageLabel ?? "PMCM planning package",
    notes: currentEvent?.briefingNotes ?? "PMCM will keep this workspace updated as planning decisions are approved.",
  }}
  floorplan={{
    status: officialFloorplan?.status ?? "not-started",
    updatedAt: officialFloorplan?.updatedAt,
    summary: officialFloorplan?.summary ?? "No official client-view floorplan has been published yet.",
    onOpen: officialFloorplan ? openReadOnlyFloorplan : undefined,
  }}
  billing={billingMilestones}
  documents={clientDocuments}
  activity={clientActivityItems}
/>
```

Adapt variable names to the existing data already fetched in the file. Preserve the current floorplan editor boundary: client actions can open read-only official floorplan views only.

- [ ] **Step 3: Remove local duplicated visual wrappers**

Delete local wrappers only after their usage is gone:

```tsx
function MetricTile(...) { ... }
function SectionCard(...) { ... }
function AlertPanel(...) { ... }
```

Keep local business actions, modals, API calls, and state transitions intact.

- [ ] **Step 4: Typecheck the client app**

Run:

```powershell
npm --workspace @prism/client run typecheck
```

Expected:

```text
> @prism/client@0.1.0 typecheck
> tsc --noEmit
```

---

## Task 3: Add Shared Public Blocks

**Files:**
- Create: `packages/ui/src/public-blocks.tsx`
- Modify: `packages/ui/src/index.ts`
- Modify: `packages/ui/package.json`

- [ ] **Step 1: Create shared public presentation blocks**

Create `packages/ui/src/public-blocks.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, LockKeyhole, ShieldCheck } from "lucide-react";
import { PrismBadge, PrismButton, PrismCard, PrismCardContent, PrismCardHeader, PrismCardTitle } from "./primitives";

export interface PrismPublicRoleCard {
  title: string;
  description: string;
  badge: string;
  href?: string;
  actionLabel?: string;
  icon?: ReactNode;
}

export interface PrismLifecycleStep {
  label: string;
  description: string;
  state?: "current" | "done" | "pending";
}

export function PrismPublicRoleGrid({ roles }: { roles: PrismPublicRoleCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {roles.map((role) => (
        <PrismCard key={role.title} className="h-full">
          <PrismCardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {role.icon ?? <ShieldCheck className="h-5 w-5" />}
              </div>
              <PrismBadge tone="info">{role.badge}</PrismBadge>
            </div>
            <PrismCardTitle>{role.title}</PrismCardTitle>
          </PrismCardHeader>
          <PrismCardContent>
            <p className="text-sm leading-6 text-muted-foreground">{role.description}</p>
            {role.href && role.actionLabel ? (
              <PrismButton asChild className="mt-5 w-full justify-between" variant="outline">
                <a href={role.href}>
                  {role.actionLabel}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </PrismButton>
            ) : null}
          </PrismCardContent>
        </PrismCard>
      ))}
    </div>
  );
}

export function PrismLifecycleStrip({ steps }: { steps: PrismLifecycleStep[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-5">
      {steps.map((step, index) => {
        const Icon = step.state === "done" ? CheckCircle2 : step.state === "current" ? ClipboardList : LockKeyhole;
        return (
          <div key={step.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-muted-foreground">Step {index + 1}</span>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground">{step.label}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.description}</p>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Export the public blocks**

Modify `packages/ui/src/index.ts`:

```ts
export * from "./public-blocks";
```

Modify `packages/ui/package.json` exports:

```json
"./public-blocks": "./src/public-blocks.tsx"
```

- [ ] **Step 3: Typecheck the UI package**

Run:

```powershell
npm --workspace @prism/ui run typecheck
```

Expected: pass with no TypeScript errors.

---

## Task 4: Refresh Public Client Landing And Inquiry

**Files:**
- Modify: `apps/client/src/app/components/landing/MainLandingPage.tsx`
- Modify: `apps/client/src/app/components/public-inquiry/PublicInquiryPage.tsx`

- [ ] **Step 1: Replace local repeated public cards with shared blocks**

Import:

```tsx
import { PrismLifecycleStrip, PrismPublicRoleGrid } from "@prism/ui/public-blocks";
```

Use these public lifecycle steps:

```tsx
const lifecycleSteps = [
  { label: "Inquiry", description: "Submit event basics through the public form.", state: "current" },
  { label: "PMCM review", description: "Ms. Mys and the PMCM team screen scope and fit.", state: "pending" },
  { label: "Conforme", description: "Client portal opens only after acceptance and signed conforme.", state: "pending" },
  { label: "Planning", description: "Briefing, billing, documents, suppliers, and official floorplan align.", state: "pending" },
  { label: "Event day", description: "PMCM runs live operations, issue escalation, and closure.", state: "pending" },
];
```

Use client/supplier/guest entry cards with safe hrefs:

```tsx
const roleCards = [
  {
    title: "Clients",
    badge: "Inquiry first",
    description: "Start with an inquiry or sign in after PMCM has accepted the event and issued portal access.",
    href: "/inquiry",
    actionLabel: "Start inquiry",
  },
  {
    title: "Suppliers",
    badge: "Assigned only",
    description: "Suppliers use the separate portal for quotes, readiness, contract metadata, and event-day status.",
    href: "http://localhost:3002/sign-in",
    actionLabel: "Supplier sign-in",
  },
  {
    title: "Guests",
    badge: "Event code",
    description: "Guests enter through an event code before check-in, consent, or feedback becomes available.",
    href: "http://localhost:3003/open",
    actionLabel: "Open guest access",
  },
];
```

Do not add `/dashboard` links to public landing files.

- [ ] **Step 2: Improve inquiry form state copy**

In `PublicInquiryPage.tsx`, make submission results explicit:

```tsx
const inquirySuccessTitle = "Inquiry received by PMCM";
const inquirySuccessDescription =
  "The dashboard is still locked. PMCM reviews the inquiry first, then sends conforme and portal access only after acceptance.";
```

Use this text in the existing success state. Keep privacy consent required before submit.

- [ ] **Step 3: Run public dashboard-link guard**

Run:

```powershell
rg -n 'href="/dashboard"|href="http://localhost:300[1-4].*/dashboard|router\.replace\("/dashboard"' apps/client/src/app/components/landing apps/client/src/app/components/public-inquiry apps/supplier/src/app/page.tsx apps/guest/src/app/page.tsx
```

Expected:

```text
No matches
```

- [ ] **Step 4: Typecheck client**

Run:

```powershell
npm --workspace @prism/client run typecheck
```

Expected: pass.

---

## Task 5: Refresh Supplier And Guest Public Landing Pages

**Files:**
- Modify: `apps/supplier/src/app/page.tsx`
- Modify: `apps/guest/src/app/page.tsx`

- [ ] **Step 1: Update supplier landing with shared public blocks**

In `apps/supplier/src/app/page.tsx`, use `PrismPublicShell` plus `PrismLifecycleStrip`. Keep the primary CTA pointed to `/sign-in`.

```tsx
const supplierSteps = [
  { label: "Assignment", description: "PMCM assigns quote or event-day responsibility.", state: "current" },
  { label: "Quote", description: "Supplier submits or revises before lock.", state: "pending" },
  { label: "Confirmation", description: "Selected assignment is confirmed with readiness and contract metadata.", state: "pending" },
  { label: "Event day", description: "Supplier posts role-safe live status updates.", state: "pending" },
  { label: "Closure", description: "PMCM verifies status and archives supplier records.", state: "pending" },
];
```

Do not link to `/dashboard` from the supplier public page.

- [ ] **Step 2: Update guest landing with shared public blocks**

In `apps/guest/src/app/page.tsx`, use `PrismPublicShell` plus a short `PrismLifecycleStrip`. Keep the primary CTA pointed to `/open`.

```tsx
const guestSteps = [
  { label: "Event code", description: "Guest access starts with a PMCM-issued event code.", state: "current" },
  { label: "Consent", description: "Privacy consent is required before check-in or feedback.", state: "pending" },
  { label: "Check-in", description: "Guest or walk-in attendance is recorded for PMCM operations.", state: "pending" },
  { label: "Feedback", description: "Feedback is submitted for moderation after or during the event.", state: "pending" },
];
```

Do not link to `/dashboard` from the guest public page.

- [ ] **Step 3: Typecheck supplier and guest**

Run:

```powershell
npm --workspace @prism/supplier run typecheck
npm --workspace @prism/guest run typecheck
```

Expected: both pass.

---

## Task 6: Polish PMCM Selected-Event Cockpit

**Files:**
- Modify: `apps/event/src/app/page.tsx`
- Modify: `apps/event/src/app/components/pmcm/client-onboarding-tracker.tsx`
- Modify: `apps/event/src/app/components/pmcm/financial-workspace.tsx`

- [ ] **Step 1: Tighten PMCM selected-event header and next actions**

In `apps/event/src/app/page.tsx`, keep `PrismDashboardShell`, then add a selected-event `RolePageHeader` when an event is active:

```tsx
<RolePageHeader
  eyebrow="PMCM command workspace"
  title={selectedEvent?.name ?? "Select an event"}
  description={selectedEvent ? "Review client state, supplier readiness, billing, floorplan, and live operations from one cockpit." : "Choose an event to open the operational workspace."}
  meta={[
    { label: selectedEvent?.status ?? "No event selected", tone: selectedEvent ? "info" : "neutral" },
    { label: `${openActionCount} open actions`, tone: openActionCount > 0 ? "warning" : "success" },
  ]}
  actions={selectedEvent ? selectedEventActions : []}
/>
```

Use existing event and action data already in `page.tsx`. Do not create new PMCM API calls.

- [ ] **Step 2: Reduce onboarding tracker density**

In `client-onboarding-tracker.tsx`, replace nested local cards with:

```tsx
<PrismSectionPanel title="Client unlock path" description="Inquiry acceptance, conforme, invitation, and briefing state">
  <PrismStatusTimeline items={clientUnlockTimeline} />
</PrismSectionPanel>
```

Build `clientUnlockTimeline` from existing inquiry/conforme/invitation state in the component. Keep existing approve, remind, upload, and unlock actions.

- [ ] **Step 3: Reduce finance panel density**

In `financial-workspace.tsx`, use:

```tsx
<PrismBillingMilestoneList milestones={billingMilestonesForUi} />
```

Map current finance records to shared milestones:

```tsx
const billingMilestonesForUi = billingStatements.flatMap((statement) =>
  statement.milestones.map((milestone) => ({
    id: milestone.id,
    title: milestone.label,
    amount: milestone.amountLabel,
    dueDate: milestone.dueDateLabel,
    status: milestone.status,
    description: milestone.notes,
  }))
);
```

Adapt exact property names to the existing `BillingStatement` and milestone types in the file. Preserve payment, dispute, and waiver buttons.

- [ ] **Step 4: Typecheck PMCM event app**

Run:

```powershell
npm --workspace @prism/event run typecheck
```

Expected: pass.

---

## Task 7: Add Repeatable UI Smoke Script

**Files:**
- Create: `scripts/smoke-prism-ui.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create the smoke script**

Create `scripts/smoke-prism-ui.mjs`:

```js
import { readFileSync } from "node:fs";

const routes = [
  "http://localhost:4000/health",
  "http://localhost:3001/",
  "http://localhost:3001/sign-in",
  "http://localhost:3001/inquiry",
  "http://localhost:3001/dashboard",
  "http://localhost:3002/",
  "http://localhost:3002/sign-in",
  "http://localhost:3002/dashboard",
  "http://localhost:3003/",
  "http://localhost:3003/open",
  "http://localhost:3003/dashboard",
  "http://localhost:3004/",
];

const publicFiles = [
  "apps/client/src/app/components/landing/MainLandingPage.tsx",
  "apps/client/src/app/components/public-inquiry/PublicInquiryPage.tsx",
  "apps/supplier/src/app/page.tsx",
  "apps/guest/src/app/page.tsx",
];

const forbiddenPatterns = [
  /href=["']\/dashboard["']/,
  /href=["']http:\/\/localhost:300[1-4][^"']*\/dashboard["']/,
  /router\.replace\(["']\/dashboard["']\)/,
];

for (const file of publicFiles) {
  const source = readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(source)) {
      throw new Error(`Public dashboard link found in ${file}: ${pattern}`);
    }
  }
}

for (const route of routes) {
  const response = await fetch(route);
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}`);
  }
  console.log(`OK ${response.status} ${route}`);
}
```

- [ ] **Step 2: Add the root script**

Modify `package.json` scripts:

```json
"smoke:ui": "node scripts/smoke-prism-ui.mjs"
```

- [ ] **Step 3: Run smoke with dev stack running**

Start stack:

```powershell
.\start-prism.cmd -SkipPrismaGenerate
```

Run smoke:

```powershell
npm run smoke:ui
```

Expected: all routes print `OK 200`.

If Windows reports `spawn EPERM` or an unlink `EPERM` during dev startup, stop partial processes and rerun the same start command outside the sandbox:

```powershell
.\stop-prism.cmd
.\start-prism.cmd -SkipPrismaGenerate
```

---

## Task 8: Final Verification And Commit

**Files:**
- All modified files from Tasks 1-7.

- [ ] **Step 1: Run root typecheck**

Run:

```powershell
npm run typecheck
```

Expected: Turbo completes all workspace typechecks.

- [ ] **Step 2: Run root build**

Run:

```powershell
npm run build
```

Expected: API and all frontend apps build successfully.

- [ ] **Step 3: Run explicit portal builds**

Run:

```powershell
npm --workspace @prism/client run build
npm --workspace @prism/supplier run build
npm --workspace @prism/guest run build
npm --workspace @prism/event run build
```

Expected: all four Next apps compile successfully.

- [ ] **Step 4: Run UI smoke**

Run with stack already started:

```powershell
npm run smoke:ui
```

Expected: all configured routes print `OK 200`.

- [ ] **Step 5: Review changed files**

Run:

```powershell
git status -sb
git diff --check
git diff --stat
```

Expected:
- Only files listed in this plan are modified.
- `git diff --check` returns no whitespace errors.

- [ ] **Step 6: Commit**

Run:

```powershell
git add packages/ui apps/client apps/supplier apps/guest apps/event scripts package.json docs/superpowers/plans/2026-05-02-prism-ui-modernization-phase-2.md
git commit -m "feat: finish prism ui modernization phase 2"
```

Expected: commit succeeds on the active feature branch.

---

## Self-Review

Spec coverage:
- Shared UI foundation is extended through client and public blocks.
- Client defense path becomes clearer without backend changes.
- Supplier and guest public pages stay separate and gated.
- PMCM cockpit polish uses shared blocks without moving floorplan ownership.
- Verification includes typecheck, build, public dashboard guard, route smoke, and portal builds.

Risk controls:
- No external providers are added.
- No `/api/demo/state` expansion is planned.
- Client official floorplan remains read-only.
- Public pages cannot link directly to dashboards.
- Shared UI remains prop-driven and does not import portal APIs.

Execution checkpoint:
- Commit Phase 1 shared UI modernization before starting this phase, or include the Phase 1 files in the same branch intentionally and review the combined diff before commit.
