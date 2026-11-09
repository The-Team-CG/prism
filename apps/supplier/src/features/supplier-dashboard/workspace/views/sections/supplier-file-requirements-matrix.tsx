"use client";

import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { EmptyState } from "@prism/ui/components/empty-state";
import type { PrismAuthenticatedSession, PrismSupplierReadinessBoard } from "@prism/types";
import { buildSupplierFileRequirementRows, formatDate } from "../../model/supplier-workspace-rules";
import { supplierBookingHref } from "../../model/supplier-next-step";
import type { SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useSupplierFileRequirementsViewModel } from "../../view-models/use-supplier-file-requirements-view-model";

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
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <FileCheck2 className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">File requirements</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Required files and due dates are shown for your selected bookings. Contract uploads and booking readiness actions are in Bookings.
        </p>
      </div>
      {viewModel.status === "loading" ? <p role="status" className="px-6 py-3 text-xs text-muted-foreground">Loading your assigned file requirements…</p> : null}
      {viewModel.status === "error" ? <p role="alert" className="px-6 py-3 text-xs text-destructive">Unable to load assigned file requirements. Refresh to try again.</p> : null}
      {viewModel.status === "ready" && rows.length === 0 ? (
        <div className="px-6 py-6">
          <EmptyState icon={FileCheck2} title="No supplier file requirements yet" description="Visible items appear after PMCM requests a contract or supporting file for your booking." />
        </div>
      ) : null}
      {rows.length > 0 ? (
        <div className="divide-y divide-border">
          {rows.map(({ eventId, requestIds, item }) => {
            const uploadedObjectId = item.uploadedObjectId;
            return (
              <div key={`${eventId}:${item.key}:${requestIds.join(":")}`} className="flex flex-wrap items-start justify-between gap-3 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">{item.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{readinessByEventId.get(eventId)?.eventName ?? "Assigned booking"} · {item.detail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.dueDate ? `Due ${formatDate(item.dueDate)}` : "No due date set"}{item.overdue ? <span className="font-semibold text-destructive"> · Overdue</span> : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {uploadedObjectId ? <button type="button" onClick={() => onDownloadObject(uploadedObjectId)} className="text-xs font-bold text-primary hover:underline">Download required file</button> : null}
                    {requestIds.map((requestId) => {
                      const request = requestById.get(requestId);
                      return (
                        <Link key={requestId} href={supplierBookingHref(requestId)} className="text-xs font-bold text-primary hover:underline">
                          {requestIds.length === 1 ? "Open booking" : `Open ${request?.category ?? "booking"} booking`}
                        </Link>
                      );
                    })}
                  </div>
                </div>
                <StatusBadge status={item.status} />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
