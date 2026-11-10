"use client";

import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { PrismEmptyLine, PrismSection } from "@prism/ui/page-blocks";
import type { PrismAuthenticatedSession, PrismSupplierReadinessBoard } from "@prism/types";
import { buildSupplierFileRequirementRows, formatDate } from "../../model/supplier-workspace-rules";
import { supplierBookingHref } from "../../model/supplier-next-step";
import type { SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useSupplierFileRequirementsViewModel } from "../../view-models/use-supplier-file-requirements-view-model";
import { LoadingState } from "@prism/ui/components/loading-state";

export function SupplierFileRequirementsMatrix({
  workspace,
  session,
  readinessBoard,
  onDownloadObject,
}: {
  workspace: SupplierWorkspace;
  session: PrismAuthenticatedSession;
  readinessBoard: PrismSupplierReadinessBoard | null;
  onDownloadObject: (objectId: string) => void;
}) {
  const viewModel = useSupplierFileRequirementsViewModel(workspace, session);
  const rows = buildSupplierFileRequirementRows(workspace, viewModel.matrices);
  const requestById = new Map(workspace.quoteRequests.map((request) => [request.id, request]));
  const readinessByEventId = new Map(readinessBoard?.items.map((item) => [item.eventId, item]) ?? []);

  return (
    <PrismSection
      id="supplier-file-requirements"
      title="File requirements"
      description="Required files and due dates for your selected bookings. Contract uploads and readiness actions are in Bookings."
      flush={rows.length > 0}
    >
      {viewModel.status === "loading" ? <LoadingState label="Loading your assigned file requirements…" /> : null}
      {viewModel.status === "error" ? <p role="alert" className="text-sm text-destructive">Unable to load assigned file requirements. Refresh to try again.</p> : null}
      {viewModel.status === "ready" && rows.length === 0 ? (
        <PrismEmptyLine icon={FileCheck2}>No supplier file requirements yet. They appear after PMCM requests a contract or supporting file for your booking.</PrismEmptyLine>
      ) : null}
      {rows.length > 0 ? (
        <ul className="divide-y divide-border">
          {rows.map(({ eventId, requestIds, item }) => {
            const uploadedObjectId = item.uploadedObjectId;
            const eventName = readinessByEventId.get(eventId)?.eventName ?? "Assigned booking";
            return (
              <li key={`${eventId}:${item.key}:${requestIds.join(":")}`} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold text-foreground">{eventName}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.label} · {item.detail}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.dueDate ? `Due ${formatDate(item.dueDate)}` : "No due date set"}{item.overdue ? <span className="font-semibold text-destructive"> · Overdue</span> : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {uploadedObjectId ? <button type="button" onClick={() => onDownloadObject(uploadedObjectId)} className="text-sm font-medium text-primary hover:underline">Download required file</button> : null}
                    {requestIds.map((requestId) => {
                      const request = requestById.get(requestId);
                      return (
                        <Link key={requestId} href={supplierBookingHref(requestId)} className="text-sm font-medium text-primary hover:underline">
                          {requestIds.length === 1 ? "Open booking" : `Open ${request?.category ?? "booking"} booking`}
                        </Link>
                      );
                    })}
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </li>
            );
          })}
        </ul>
      ) : null}
    </PrismSection>
  );
}
