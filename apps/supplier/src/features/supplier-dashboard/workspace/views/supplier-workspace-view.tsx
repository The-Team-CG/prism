"use client";


import { DashboardPage } from "./sections/dashboard-page";
import { RequestsPage } from "./sections/requests-page";
import { BookingsPage } from "./sections/bookings-page";
import { CalendarPage } from "./sections/calendar-page";
import { QuotationsPage } from "./sections/quotations-page";
import { MessagesPage } from "./sections/messages-page";
import { FilesPage } from "./sections/files-page";
import { PaymentsPage } from "./sections/payments-page";
import { ProfilePage } from "./sections/profile-page";
import { SupportPage } from "./sections/support-page";
import { Card, CardBody } from "./sections/shell-ui";

import { FormEvent, useMemo } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  HelpCircle,
  LockKeyhole,
  LogOut,
  MessageSquare,
  PackageCheck,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { PrismDashboardShell } from "@prism/ui";
import {
  EVENT_STATUS_ACTIONS,
  buildBookingSteps,
  buildCalendarEvents,
  closedRequestReason,
  firstNameFrom,
  formatDate,
  formatMoney,
  fmt,
  greetingForHour,
  initialForm,
  isPastDate,
  isRequestClosed,
  readinessTone,
} from "../model/supplier-workspace-rules";
import type {
  PrismSupplier,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  QuoteFormState,
  SupplierDashboardSection,
  SupplierSession,
  SupplierWorkspace,
} from "../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "../view-models/use-supplier-workspace-view-model";

type Section = SupplierDashboardSection;

/* ── Shared card primitives ──────────────────────────────────── */


/* ── Page: Dashboard ─────────────────────────────────────────── */

/* ── Page: Requests ──────────────────────────────────────────── */

/* ── Page: Bookings ──────────────────────────────────────────── */

/* ── Page: Calendar ──────────────────────────────────────────── */

/* ── Page: Quotations ────────────────────────────────────────── */

/* ── Page: Messages ──────────────────────────────────────────── */

/* ── Page: Files ─────────────────────────────────────────────── */

/* ── Page: Payments ──────────────────────────────────────────── */

/* ── Page: Profile ───────────────────────────────────────────── */

/* ── Page: Support ───────────────────────────────────────────── */

/* ── Main dashboard ──────────────────────────────────────────── */

export function SupplierWorkspaceView() {
  const vm = useSupplierWorkspaceViewModel();
  const {
    session,
    workspace,
    readinessBoard,
    section,
    setSection,
    forms,
    readinessNotes,
    contractFiles,
    statusNotes,
    error,
    notice,
    busy,
    derived,
    meta,
  } = vm;

  const {
    quoteByRequest,
    openRequests,
    selectedRequests,
    selectedQuotes,
    quoteNeedingSubmission,
    handoffPending,
    readinessNeedsActionCount,
    needsActionCount,
    eventsThisMonth,
  } = derived;

  /* Loading */
  if (!session || (!workspace && !error)) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
      </main>
    );
  }

  /* Wrong role */
  if (session.role !== "supplier") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <ShieldCheck className="size-12 rounded-xl bg-amber-50 p-2.5 text-amber-600" />
          <h1 className="mt-5 text-xl font-bold text-foreground">Wrong portal for this account.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Supplier dashboard access requires an approved supplier account.</p>
          <Button className="mt-5 rounded-xl font-bold" onClick={vm.goToSignIn}>Use supplier sign-in</Button>
        </div>
      </main>
    );
  }

  if (!meta) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
      </main>
    );
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Warehouse, badge: needsActionCount || undefined },
    { id: "requests", label: "Requests", icon: ClipboardList, badge: openRequests.length || undefined },
    { id: "bookings", label: "Bookings", icon: BadgeCheck, badge: handoffPending || undefined },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "quotations", label: "Quotations", icon: FileText },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "files", label: "Files", icon: FileCheck2 },
    { id: "payments", label: "Payments", icon: Wallet },
    { id: "profile", label: "Services / Profile", icon: User },
    { id: "support", label: "Support", icon: HelpCircle },
  ];

  return (
    <PrismDashboardShell
      roleLabel="Supplier portal"
      eyebrow={meta.eyebrow}
      title={meta.title}
      description={meta.description}
      activeItemId={section}
      navItems={navItems}
      sidebarMode="single"
      onNavSelect={(id) => setSection(id as Section)}
      user={{ name: session.name, detail: session.organization, initials: session.name.slice(0, 2).toUpperCase() }}
      searchPlaceholder="Search quotes, requests…"
      commandActions={[
        { id: "requests", label: quoteNeedingSubmission ? `${quoteNeedingSubmission} quote(s) need submission` : `${openRequests.length} open request(s)`, description: "Submit or revise before the deadline.", icon: ClipboardList, status: quoteNeedingSubmission ? "pending" : "completed", onSelect: () => setSection("requests") },
        { id: "bookings", label: handoffPending ? "Booking handoff needs action" : readinessBoard ? `${readinessBoard.counts.info} readiness item(s) monitored` : "Handoff is clear", description: "Confirm assignment, readiness, and contract.", icon: PackageCheck, status: handoffPending || readinessNeedsActionCount ? "pending" : "confirmed", onSelect: () => setSection("bookings") },
      ]}
      onSignOut={vm.signOut}
      headerActions={
        <>
          <Button variant="outline" size="icon" disabled={busy === "refresh"} onClick={() => void vm.refresh()} className="size-9 rounded-xl" aria-label="Refresh">
            <RefreshCcw className="size-3.5" />
          </Button>
          <Badge variant="outline" className="hidden h-9 rounded-xl border-(--prism-success)/25 bg-(--prism-success)/8 px-3 text-(--prism-success) sm:inline-flex">
            Approved
          </Badge>
        </>
      }
      mobileActions={[
        { id: "requests", label: "Requests", icon: ClipboardList, active: section === "requests", onSelect: () => setSection("requests") },
        { id: "bookings", label: "Bookings", icon: BadgeCheck, active: section === "bookings", onSelect: () => setSection("bookings") },
        { id: "logout", label: "Sign out", icon: LogOut, onSelect: vm.signOut },
      ]}
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-xl border border-(--prism-danger)/25 bg-(--prism-danger)/8 px-5 py-3.5 text-sm font-semibold text-(--prism-danger)">{error}</div>
        )}
        {notice && (
          <div className="rounded-xl border border-(--prism-success)/25 bg-(--prism-success)/8 px-5 py-3.5 text-sm font-semibold text-(--prism-success)">{notice}</div>
        )}

        {section === "dashboard" && workspace && (
          <DashboardPage
            session={session} workspace={workspace} quoteByRequest={quoteByRequest}
            openRequests={openRequests} selectedRequests={selectedRequests}
            selectedQuotes={selectedQuotes} quoteNeedingSubmission={quoteNeedingSubmission}
            handoffPending={handoffPending} needsActionCount={needsActionCount}
            eventsThisMonth={eventsThisMonth} readinessBoard={readinessBoard} onNavigate={setSection}
          />
        )}

        {section === "requests" && workspace && (
          <RequestsPage
            workspace={workspace} quoteByRequest={quoteByRequest}
            forms={forms} busy={busy}
            onUpdateForm={vm.updateForm}
            onSubmitQuote={vm.submitQuote}
          />
        )}

        {section === "bookings" && workspace && (
          <BookingsPage
            selectedRequests={selectedRequests} session={session}
            readinessNotes={readinessNotes} contractFiles={contractFiles} statusNotes={statusNotes}
            busy={busy}
            onReadinessNoteChange={vm.setReadinessNote}
            onContractFileChange={vm.setContractFile}
            onStatusNoteChange={vm.setStatusNote}
            onConfirmAssignment={(req) => void vm.confirmAssignment(req)}
            onConfirmReadiness={(req) => void vm.confirmReadiness(req)}
            onSaveContract={(req) => void vm.saveContract(req)}
            onUpdateStatus={(req, status) => void vm.updateStatus(req, status)}
          />
        )}

        {section === "calendar" && workspace && (
          <CalendarPage workspace={workspace} quoteByRequest={quoteByRequest} />
        )}

        {section === "quotations" && workspace && (
          <QuotationsPage workspace={workspace} quoteByRequest={quoteByRequest} />
        )}

        {section === "messages" && <MessagesPage />}

        {section === "files" && workspace && <FilesPage workspace={workspace} />}

        {section === "payments" && workspace && <PaymentsPage workspace={workspace} />}

        {section === "profile" && workspace && (
          <ProfilePage supplier={workspace.supplier} session={session} />
        )}

        {section === "support" && <SupportPage />}

        {!workspace && error && (
          <Card><CardBody>
            <EmptyState icon={ShieldCheck} title="Unable to load workspace" description={error} />
          </CardBody></Card>
        )}
      </div>
    </PrismDashboardShell>
  );
}
