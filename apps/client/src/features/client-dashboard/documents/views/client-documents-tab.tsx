"use client";
import { formatPortalDateTime } from "@prism/ui/format-date";

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
  const { selectedEvent } = useClientWorkspace();
  const storedFiles = selectedEvent ? <ClientStoredFilesPanel key={`files-${selectedEvent.id}`} eventId={selectedEvent.id} /> : null;

  if (documents.length === 0) {
    return (
      <div className="space-y-5">
        {storedFiles}
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
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">PMCM-issued records</h2>
          <p className="text-sm text-muted-foreground">Signed conforme, billing statements and approval documents.</p>
        </div>
        <p className="text-sm tabular-nums text-muted-foreground">
          {receivedCount} of {documents.length} received
        </p>
      </div>

      {Array.from(groups.entries()).map(([cat, docs]) => (
        <Card key={cat}>
          <CardHeader>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">{cat}</h3>
              <span className="text-sm tabular-nums text-muted-foreground">{docs.length}</span>
            </div>
          </CardHeader>
          <div className="divide-y divide-border">
            {docs.map((doc) => (
              <div key={doc.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3.5 sm:px-6">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium text-foreground">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatLabel(doc.type)} — {formatPortalDateTime(doc.uploadedAt)}</p>
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
