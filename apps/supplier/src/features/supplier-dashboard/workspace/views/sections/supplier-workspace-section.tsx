"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
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
import { supplierSectionHref } from "../../model/supplier-workspace-types";
import { BookingsPage } from "./bookings-page";
import { CalendarPage } from "./calendar-page";
import { DashboardPage } from "./dashboard-page";
import { FilesPage } from "./files-page";
import { MessagesPage } from "./messages-page";
import { PaymentsPage } from "./payments-page";
import { ProfilePage } from "./profile-page";
import { QuotationsPage } from "./quotations-page";
import { RequestsPage } from "./requests-page";
import { SupportPage } from "./support-page";
import { Card, CardBody } from "./shell-ui";

export type SupplierWorkspaceSectionProps = {
  section: SupplierDashboardSection;
  session: PrismAuthenticatedSession;
  workspace: SupplierWorkspace | null;
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
  error: string | null;
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
  onReadinessNoteChange: (id: string, v: string) => void;
  onStatusNoteChange: (id: string, v: string) => void;
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

type SectionRenderer = (props: SupplierWorkspaceSectionProps & { workspace: SupplierWorkspace }) => React.ReactNode;

const SECTION_RENDERERS: Record<SupplierDashboardSection, SectionRenderer> = {
  dashboard: (p) => (
    <DashboardPage
      quoteNeedingSubmission={p.quoteNeedingSubmission}
      handoffPending={p.handoffPending}
      readinessBoard={p.readinessBoard}
      quoteByRequest={p.quoteByRequest}
    />
  ),
  requests: (p) => (
    <RequestsPage
      workspace={p.workspace}
      quoteByRequest={p.quoteByRequest}
      readinessBoard={p.readinessBoard}
      forms={p.forms}
      busy={p.busy}
      onUpdateForm={p.onUpdateForm}
      onSubmitQuote={p.onSubmitQuote}
    />
  ),
  bookings: (p) => (
    <BookingsPage
      selectedRequests={p.selectedRequests}
      session={p.session}
      readinessBoard={p.readinessBoard}
      readinessNotes={p.readinessNotes}
      workflowWorkspace={p.workflowWorkspace}
      statusNotes={p.statusNotes}
      busy={p.busy}
      onReadinessNoteChange={p.onReadinessNoteChange}
      onStatusNoteChange={p.onStatusNoteChange}
      onConfirmAssignment={p.onConfirmAssignment}
      onConfirmReadiness={p.onConfirmReadiness}
      onSaveContract={p.onSaveContract}
      onUpdateStatus={p.onUpdateStatus}
      onAcknowledgeSchedule={p.onAcknowledgeSchedule}
      onRequestScheduleChange={p.onRequestScheduleChange}
      onUpdateProgress={p.onUpdateProgress}
      onSubmitCreativeTask={p.onSubmitCreativeTask}
      onDownloadObject={p.onDownloadObject}
    />
  ),
  calendar: (p) => <CalendarPage workspace={p.workspace} quoteByRequest={p.quoteByRequest} />,
  quotations: (p) => <QuotationsPage workspace={p.workspace} quoteByRequest={p.quoteByRequest} />,
  messages: (p) => <MessagesPage session={p.session} selectedRequests={p.selectedRequests} readinessBoard={p.readinessBoard} />,
  files: (p) => <FilesPage workspace={p.workspace} session={p.session} workflowWorkspace={p.workflowWorkspace} onDownloadObject={p.onDownloadObject} />,
  payments: (p) => <PaymentsPage workspace={p.workspace} workflowWorkspace={p.workflowWorkspace} />,
  profile: (p) => <ProfilePage supplier={p.workspace.supplier} session={p.session} />,
  support: () => <SupportPage />,
};

export function SupplierWorkspaceSection(props: SupplierWorkspaceSectionProps) {
  if (!props.workspace) {
    return props.error ? (
      <Card>
        <CardBody>
          <EmptyState icon={ShieldCheck} title="Unable to load workspace" description={props.error} />
        </CardBody>
      </Card>
    ) : null;
  }
  const content = SECTION_RENDERERS[props.section]({ ...props, workspace: props.workspace });
  if (props.section !== "requests" && props.section !== "quotations") return content;
  return (
    <div className="space-y-5">
      <nav aria-label="Requests and quotes" className="flex flex-wrap gap-2">
        {([
          { section: "requests", label: "Requests" },
          { section: "quotations", label: "Submitted quotes" },
        ] as const).map((item) => (
          <Link
            key={item.section}
            href={supplierSectionHref(item.section)}
            aria-current={props.section === item.section ? "page" : undefined}
            className={props.section === item.section
              ? "rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background"
              : "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {content}
    </div>
  );
}
