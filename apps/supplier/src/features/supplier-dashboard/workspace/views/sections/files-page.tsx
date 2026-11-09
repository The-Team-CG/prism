"use client";

import { FileCheck2, FileText, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@prism/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { buildSupplierContractRequirements, formatDate } from "../../model/supplier-workspace-rules";
import type { PrismAuthenticatedSession } from "@prism/types";
import type { PrismSupplierReadinessBoard, PrismSupplierWorkflowWorkspace } from "@prism/types";
import type { SupplierWorkspace } from "../../model/supplier-workspace-types";
import { SupplierFileRequirementsMatrix } from "./supplier-file-requirements-matrix";

export function FilesPage({
  workspace,
  session,
  workflowWorkspace,
  readinessBoard,
  onDownloadObject,
}: {
  workspace: SupplierWorkspace;
  session: PrismAuthenticatedSession;
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
  readinessBoard: PrismSupplierReadinessBoard | null;
  onDownloadObject: (objectId: string) => void;
}) {
  const contracts = workflowWorkspace?.contracts ?? [];
  const hasBooking = buildSupplierContractRequirements(workspace).length > 0;

  return (
    <div className="space-y-4">
      <SupplierFileRequirementsMatrix workspace={workspace} session={session} readinessBoard={readinessBoard} onDownloadObject={onDownloadObject} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <FileCheck2 className="size-4 text-primary" />
            Contract files
          </CardTitle>
          <CardDescription className="text-xs">Your uploaded contract versions and PMCM review status.</CardDescription>
        </CardHeader>
        {contracts.length === 0 ? (
          <CardContent>
            <Empty className="border-0 p-6 md:p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FileCheck2 /></EmptyMedia>
                <EmptyTitle>No contract files uploaded.</EmptyTitle>
                <EmptyDescription>{hasBooking ? "Upload your signed contract from the booking that needs it." : "Upload a signed contract from Bookings once PMCM selects your quote."}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {contracts.map((contract) => (
              <div key={contract.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-primary">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">v{contract.version} · {contract.fileName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Uploaded {formatDate(contract.uploadedAt)}{contract.reviewReason ? ` · ${contract.reviewReason}` : ""}</p>
                </div>
                <StatusBadge status={contract.reviewStatus} />
                <button type="button" onClick={() => onDownloadObject(contract.storedObjectId)} className="text-xs font-bold text-primary hover:underline">Download</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="size-4 text-primary" />
            Certifications
          </CardTitle>
        </CardHeader>
        {workspace.supplier.certifications.length === 0 ? (
          <CardContent>
            <Empty className="border-0 p-6 md:p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon"><ShieldCheck /></EmptyMedia>
                <EmptyTitle>No certifications on file.</EmptyTitle>
                <EmptyDescription>PMCM will upload certification documents to your supplier record.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {workspace.supplier.certifications.map((cert) => (
              <div key={cert.id} className="flex items-center gap-4 px-6 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-primary">
                  <FileCheck2 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{cert.fileName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {cert.documentType ?? "Document"}
                    {cert.issuer ? ` — ${cert.issuer}` : ""}
                    {cert.expiresAt ? ` — Expires ${formatDate(cert.expiresAt)}` : ""}
                  </p>
                </div>
                {cert.status && <StatusBadge status={cert.status} />}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
