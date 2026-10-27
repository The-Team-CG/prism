"use client";

import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  Presentation,
  ReceiptText,
  ThumbsUp,
  Timer,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { PrismAuditLog, PrismBillingStatement, PrismBriefing, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import {
  Card,
  CardBody,
  CardHeader,
  DataRow,
  InfoGrid,
  SectionLabel,
  actorInitials,
  clientActivityActor,
  clientActivityTitle,
  formatDayLabel,
  formatLabel,
  groupByDay,
  money,
  portalBadgeStatus,
  portalStatusLabel,
} from "../../shared/tab-ui";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientFileRequirementsMatrix } from "../../files/views/client-file-requirements-matrix";
import { ClientStoredFilesPanel } from "../../files/views/client-stored-files-panel";


const docCategories: Record<string, string[]> = {
  "Conforme & MOA": ["conforme", "moa", "nda", "contract"],
  Proposals: ["proposal", "briefing", "budget"],
  Floorplans: ["floorplan", "layout", "floor_plan"],
};

function categorizeDoc(doc: PrismDocument) {
  const key = `${doc.fileName} ${doc.type}`.toLowerCase();
  for (const [cat, keywords] of Object.entries(docCategories)) {
    if (keywords.some((kw) => key.includes(kw))) return cat;
  }
  return "Other";
}

export function ClientDocumentsTab({ documents }: { documents: PrismDocument[] }) {
  const { selectedEvent, session } = useClientWorkspace();
  const matrix = selectedEvent ? (
    <ClientFileRequirementsMatrix key={`requirements-${selectedEvent.id}`} eventId={selectedEvent.id} session={session} />
  ) : null;
  const storedFiles = selectedEvent ? <ClientStoredFilesPanel key={`files-${selectedEvent.id}`} eventId={selectedEvent.id} /> : null;

  if (documents.length === 0) {
    return (
      <div className="space-y-5">
        {storedFiles}
        {matrix}
        <p className="text-sm text-muted-foreground">PMCM-issued document records will appear here when they are available.</p>
      </div>
    );
  }

  const groups = new Map<string, PrismDocument[]>();
  for (const doc of documents) {
    const cat = categorizeDoc(doc);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(doc);
  }

  const receivedCount = documents.filter((d) => d.status === "approved" || d.status === "received").length;

  return (
    <div className="space-y-5">
      {storedFiles}
      {matrix}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <FileText className="size-5" />
        </span>
        <div>
          <p className="text-base font-bold text-foreground">
            {receivedCount} of {documents.length} document{documents.length === 1 ? "" : "s"} received
          </p>
          <p className="text-xs text-muted-foreground">Signed conforme, billing statements, and approval documents</p>
        </div>
      </div>

      {Array.from(groups.entries()).map(([cat, docs]) => (
        <Card key={cat}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">{cat}</h3>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-3xs font-bold text-muted-foreground">{docs.length}</span>
            </div>
          </CardHeader>
          <div className="divide-y divide-border">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatLabel(doc.type)} — {doc.uploadedAt}</p>
                  </div>
                </div>
                <StatusBadge status={doc.status} label={formatLabel(doc.status)} />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
