"use client";

import type { FormEvent, ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { PrismAuthenticatedSession } from "@prism/types";
import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
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
        <ShieldCheck className="size-12 rounded-xl bg-attention-soft p-2.5 text-attention" />
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
        <div className="rounded-xl border border-danger/25 bg-danger/8 px-5 py-3.5 text-sm font-semibold text-danger">{error}</div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-success/25 bg-success/8 px-5 py-3.5 text-sm font-semibold text-success">{notice}</div>
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
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
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
  statusNotes: Record<string, string>;
  onNavigate: (section: SupplierDashboardSection) => void;
  onUpdateForm: (id: string, patch: Partial<QuoteFormState>) => void;
  onSubmitQuote: (ev: FormEvent<HTMLFormElement>, req: PrismSupplierQuoteRequest) => void;
  onReadinessNoteChange: (id: string, value: string) => void;
  onStatusNoteChange: (id: string, value: string) => void;
  onConfirmAssignment: (req: PrismSupplierQuoteRequest) => void;
  onConfirmReadiness: (req: PrismSupplierQuoteRequest) => void;
  onSaveContract: (req: PrismSupplierQuoteRequest, file: File) => void;
  onUpdateStatus: (req: PrismSupplierQuoteRequest, status: string) => void;
  onAcknowledgeSchedule: (requestId: string, revision: number) => void;
  onRequestScheduleChange: (requestId: string, revision: number, reason: string) => void;
  onUpdateProgress: (taskId: string, note: string) => void;
  onSubmitCreativeTask: (requestId: string, taskId: string, note: string, file?: File) => void;
  onDownloadObject: (objectId: string) => void;
};

function renderDashboard(ctx: SectionContext) {
  if (!ctx.workspace) return null;
  return (
    <DashboardPage
      quoteNeedingSubmission={ctx.quoteNeedingSubmission}
      handoffPending={ctx.handoffPending}
      readinessBoard={ctx.readinessBoard}
      quoteByRequest={ctx.quoteByRequest}
    />
  );
}

function renderRequests(ctx: SectionContext) {
  if (!ctx.workspace) return null;
  return (
    <RequestsPage
      workspace={ctx.workspace} quoteByRequest={ctx.quoteByRequest}
      readinessBoard={ctx.readinessBoard}
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
      readinessBoard={ctx.readinessBoard}
      readinessNotes={ctx.readinessNotes} workflowWorkspace={ctx.workflowWorkspace} statusNotes={ctx.statusNotes}
      busy={ctx.busy}
      onReadinessNoteChange={ctx.onReadinessNoteChange}
      onStatusNoteChange={ctx.onStatusNoteChange}
      onConfirmAssignment={ctx.onConfirmAssignment}
      onConfirmReadiness={ctx.onConfirmReadiness}
      onSaveContract={ctx.onSaveContract}
      onUpdateStatus={ctx.onUpdateStatus}
      onAcknowledgeSchedule={ctx.onAcknowledgeSchedule}
      onRequestScheduleChange={ctx.onRequestScheduleChange}
      onUpdateProgress={ctx.onUpdateProgress}
      onSubmitCreativeTask={ctx.onSubmitCreativeTask}
      onDownloadObject={ctx.onDownloadObject}
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
  return <FilesPage workspace={ctx.workspace} session={ctx.session} workflowWorkspace={ctx.workflowWorkspace} onDownloadObject={ctx.onDownloadObject} />;
}

function renderPayments(ctx: SectionContext) {
  if (!ctx.workspace) return null;
  return <PaymentsPage workspace={ctx.workspace} workflowWorkspace={ctx.workflowWorkspace} />;
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
  messages: (ctx) => <MessagesPage session={ctx.session} selectedRequests={ctx.selectedRequests} readinessBoard={ctx.readinessBoard} />,
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
