"use client";

import type { FormEvent, ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { PrismAuthenticatedSession } from "@prism/types";
import type {
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  QuoteFormState,
  SupplierDashboardSection,
  SupplierWorkspace,
} from "../../model/supplier-workspace-types";
import { Card, CardBody } from "./shell-ui";
import { DashboardPage } from "./dashboard-page";
import { RequestsPage } from "./requests-page";
import { BookingsPage } from "./bookings-page";
import { CalendarPage } from "./calendar-page";
import { QuotationsPage } from "./quotations-page";
import { MessagesPage } from "./messages-page";
import { FilesPage } from "./files-page";
import { PaymentsPage } from "./payments-page";
import { ProfilePage } from "./profile-page";
import { SupportPage } from "./support-page";

export function SupplierLoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-background">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
    </main>
  );
}

export function SupplierWrongPortal({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <ShieldCheck className="size-12 rounded-xl bg-amber-50 p-2.5 text-amber-600" />
        <h1 className="mt-5 text-xl font-bold text-foreground">Wrong portal for this account.</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Supplier dashboard access requires an approved supplier account.</p>
        <Button className="mt-5 rounded-xl font-bold" onClick={onSignIn}>Use supplier sign-in</Button>
      </div>
    </main>
  );
}

export function supplierWorkspaceGate(
  session: PrismAuthenticatedSession | null,
  workspace: SupplierWorkspace | null,
  error: string | null,
  meta: unknown,
  onSignIn: () => void,
) {
  if (!session || (!workspace && !error)) return <SupplierLoadingScreen />;
  if (session.role !== "supplier") return <SupplierWrongPortal onSignIn={onSignIn} />;
  if (!meta) return <SupplierLoadingScreen />;
  return null;
}

function WorkspaceBanners({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error ? (
        <div className="rounded-xl border border-(--prism-danger)/25 bg-(--prism-danger)/8 px-5 py-3.5 text-sm font-semibold text-(--prism-danger)">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-(--prism-success)/25 bg-(--prism-success)/8 px-5 py-3.5 text-sm font-semibold text-(--prism-success)">{notice}</div>
      ) : null}
    </>
  );
}

function WorkspaceLoadError({ workspace, error }: { workspace: SupplierWorkspace | null; error: string | null }) {
  if (workspace || !error) return null;
  return (
    <Card><CardBody>
      <EmptyState icon={ShieldCheck} title="Unable to load workspace" description={error} />
    </CardBody></Card>
  );
}

type SectionContext = {
  session: PrismAuthenticatedSession;
  workspace: SupplierWorkspace | null;
  quoteByRequest: Map<string, PrismSupplierQuote>;
  openRequests: PrismSupplierQuoteRequest[];
  selectedRequests: PrismSupplierQuoteRequest[];
  selectedQuotes: PrismSupplierQuote[];
  quoteNeedingSubmission: number;
  handoffPending: number;
  needsActionCount: number;
  eventsThisMonth: number;
  readinessBoard: PrismSupplierReadinessBoard | null;
  forms: Record<string, QuoteFormState>;
  busy: string | null;
  readinessNotes: Record<string, string>;
  contractFiles: Record<string, string>;
  statusNotes: Record<string, string>;
  onNavigate: (section: SupplierDashboardSection) => void;
  onUpdateForm: (id: string, patch: Partial<QuoteFormState>) => void;
  onSubmitQuote: (ev: FormEvent<HTMLFormElement>, req: PrismSupplierQuoteRequest) => void;
  onReadinessNoteChange: (id: string, value: string) => void;
  onContractFileChange: (id: string, value: string) => void;
  onStatusNoteChange: (id: string, value: string) => void;
  onConfirmAssignment: (req: PrismSupplierQuoteRequest) => void;
  onConfirmReadiness: (req: PrismSupplierQuoteRequest) => void;
  onSaveContract: (req: PrismSupplierQuoteRequest) => void;
  onUpdateStatus: (req: PrismSupplierQuoteRequest, status: string) => void;
};

function renderDashboard(ctx: SectionContext) {
  if (!ctx.workspace) return null;
  return (
    <DashboardPage
      session={ctx.session} workspace={ctx.workspace} quoteByRequest={ctx.quoteByRequest}
      openRequests={ctx.openRequests} selectedRequests={ctx.selectedRequests}
      selectedQuotes={ctx.selectedQuotes} quoteNeedingSubmission={ctx.quoteNeedingSubmission}
      handoffPending={ctx.handoffPending} needsActionCount={ctx.needsActionCount}
      eventsThisMonth={ctx.eventsThisMonth} readinessBoard={ctx.readinessBoard} onNavigate={ctx.onNavigate}
    />
  );
}

function renderRequests(ctx: SectionContext) {
  if (!ctx.workspace) return null;
  return (
    <RequestsPage
      workspace={ctx.workspace} quoteByRequest={ctx.quoteByRequest}
      forms={ctx.forms} busy={ctx.busy}
      onUpdateForm={ctx.onUpdateForm}
      onSubmitQuote={ctx.onSubmitQuote}
    />
  );
}

function renderBookings(ctx: SectionContext) {
  if (!ctx.workspace) return null;
  return (
    <BookingsPage
      selectedRequests={ctx.selectedRequests} session={ctx.session}
      readinessNotes={ctx.readinessNotes} contractFiles={ctx.contractFiles} statusNotes={ctx.statusNotes}
      busy={ctx.busy}
      onReadinessNoteChange={ctx.onReadinessNoteChange}
      onContractFileChange={ctx.onContractFileChange}
      onStatusNoteChange={ctx.onStatusNoteChange}
      onConfirmAssignment={ctx.onConfirmAssignment}
      onConfirmReadiness={ctx.onConfirmReadiness}
      onSaveContract={ctx.onSaveContract}
      onUpdateStatus={ctx.onUpdateStatus}
    />
  );
}

function renderCalendar(ctx: SectionContext) {
  if (!ctx.workspace) return null;
  return <CalendarPage workspace={ctx.workspace} quoteByRequest={ctx.quoteByRequest} />;
}

function renderQuotations(ctx: SectionContext) {
  if (!ctx.workspace) return null;
  return <QuotationsPage workspace={ctx.workspace} quoteByRequest={ctx.quoteByRequest} />;
}

function renderFiles(ctx: SectionContext) {
  if (!ctx.workspace) return null;
  return <FilesPage workspace={ctx.workspace} />;
}

function renderPayments(ctx: SectionContext) {
  if (!ctx.workspace) return null;
  return <PaymentsPage workspace={ctx.workspace} />;
}

function renderProfile(ctx: SectionContext) {
  if (!ctx.workspace) return null;
  return <ProfilePage supplier={ctx.workspace.supplier} session={ctx.session} />;
}

const SECTION_RENDERERS: Record<SupplierDashboardSection, (ctx: SectionContext) => ReactNode> = {
  dashboard: renderDashboard,
  requests: renderRequests,
  bookings: renderBookings,
  calendar: renderCalendar,
  quotations: renderQuotations,
  messages: () => <MessagesPage />,
  files: renderFiles,
  payments: renderPayments,
  profile: renderProfile,
  support: () => <SupportPage />,
};

export function SupplierWorkspaceBody({
  section,
  error,
  notice,
  ...ctx
}: SectionContext & {
  section: SupplierDashboardSection;
  error: string | null;
  notice: string | null;
}) {
  const render = SECTION_RENDERERS[section];
  return (
    <div className="space-y-5">
      <WorkspaceBanners error={error} notice={notice} />
      {render(ctx)}
      <WorkspaceLoadError workspace={ctx.workspace} error={error} />
    </div>
  );
}
