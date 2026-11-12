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
  const documentRows = rows.filter(({ item }) => item.uploadedObjectId || item.origin === "custom");
  const bookingRequirements = rows.length - documentRows.length;
  const requestById = new Map(workspace.quoteRequests.map((request) => [request.id, request]));
  const readinessByEventId = new Map(readinessBoard?.items.map((item) => [item.eventId, item]) ?? []);

  return (
    <PrismSection
      id="supplier-file-requirements"
      title="Booking documents"
      description="Uploaded files, their review history, and supporting files requested by PMCM."
      flush={documentRows.length > 0}
    >
      {viewModel.status === "loading" ? <LoadingState label="Loading your assigned file requirements…" /> : null}
      {viewModel.status === "error" ? <p role="alert" className="text-sm text-destructive">Unable to load assigned file requirements. Refresh to try again.</p> : null}
      {viewModel.status !== "error" && viewModel.error ? <p role="alert" className="text-sm text-destructive">{viewModel.error}</p> : null}
      {viewModel.status === "ready" && rows.length === 0 ? (
        <PrismEmptyLine icon={FileCheck2}>No supplier file requirements yet. They appear after PMCM requests a contract or supporting file for your booking.</PrismEmptyLine>
      ) : null}
      {bookingRequirements > 0 ? <p className="px-5 py-3 text-sm text-muted-foreground">{bookingRequirements} booking requirements remain outstanding. <Link href="/dashboard/bookings" className="font-medium text-foreground hover:underline">Review them in Bookings</Link>.</p> : null}
      {documentRows.length > 0 ? (
        <ul className="divide-y divide-border">
          {documentRows.map(({ eventId, requestIds, item }) => {
            const uploadedObjectId = item.uploadedObjectId;
            const eventName = readinessByEventId.get(eventId)?.eventName ?? "Assigned booking";
            return (
              <li key={`${eventId}:${item.key}:${requestIds.join(":")}`} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold text-foreground">{eventName}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{item.label} · {item.detail}</p>
                  {item.reviewReason ? <p className="mt-1 text-sm text-destructive">PMCM requested a replacement: {item.reviewReason}</p> : null}
                  {(item.versions?.length ?? 0) > 1 ? <details className="mt-2 text-sm"><summary>Previous versions</summary><ul>{item.versions?.slice(1).map((version) => <li key={version.documentId}><button type="button" onClick={() => onDownloadObject(version.objectId)} className="text-foreground">{version.fileName}</button> · {formatDate(version.uploadedAt)} · {version.status}{version.reviewReason ? ` · ${version.reviewReason}` : ""}</li>)}</ul></details> : null}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.dueDate ? `Due ${formatDate(item.dueDate)}` : "No due date set"}{item.overdue ? <span className="font-semibold text-destructive"> · Overdue</span> : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {uploadedObjectId ? <button type="button" onClick={() => onDownloadObject(uploadedObjectId)} className="text-sm font-medium text-foreground hover:underline">Download required file</button> : null}
                    {item.origin === "custom" && item.ownerRole === "supplier" ? (
                      <label className="cursor-pointer text-sm font-medium text-foreground">
                        {viewModel.uploading === `${eventId}:${item.key}` ? "Uploading..." : uploadedObjectId ? "Replace file" : "Upload file"}
                        <input type="file" className="sr-only" aria-label={`Upload ${item.label} for ${eventName}`} disabled={viewModel.uploading !== null} onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = "";
                          if (file) void viewModel.upload(eventId, item.key, file);
                        }} />
                      </label>
                    ) : null}
                    {requestIds.map((requestId) => {
                      const request = requestById.get(requestId);
                      return (
                        <Link key={requestId} href={supplierBookingHref(requestId)} className="text-sm font-medium text-foreground hover:underline">
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
