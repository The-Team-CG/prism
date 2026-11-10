"use client";

import { FileCheck2, FileText, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { PrismEmptyLine, PrismPageColumn, PrismSection } from "@prism/ui/page-blocks";
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
  const certifications = workspace.supplier.certifications;
  const hasBooking = buildSupplierContractRequirements(workspace).length > 0;

  return (
    <PrismPageColumn>
      <SupplierFileRequirementsMatrix workspace={workspace} session={session} readinessBoard={readinessBoard} onDownloadObject={onDownloadObject} />
      <PrismSection
        id="supplier-contract-files"
        title="Contract files"
        description="Your uploaded contract versions and PMCM review status."
        flush={contracts.length > 0}
      >
        {contracts.length === 0 ? (
          <PrismEmptyLine icon={FileCheck2}>
            No contract files uploaded. {hasBooking ? "Upload your signed contract from the booking that needs it." : "Upload a signed contract from Bookings once PMCM selects your quote."}
          </PrismEmptyLine>
        ) : (
          <ul className="divide-y divide-border">
            {contracts.map((contract) => (
              <li key={contract.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">v{contract.version} · {contract.fileName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Uploaded {formatDate(contract.uploadedAt)}{contract.reviewReason ? ` · ${contract.reviewReason}` : ""}</p>
                </div>
                <StatusBadge status={contract.reviewStatus} />
                <button type="button" onClick={() => onDownloadObject(contract.storedObjectId)} className="text-sm font-medium text-primary hover:underline">Download</button>
              </li>
            ))}
          </ul>
        )}
      </PrismSection>

      <PrismSection id="supplier-certifications" title="Certifications" flush={certifications.length > 0}>
        {certifications.length === 0 ? (
          <PrismEmptyLine icon={ShieldCheck}>No certifications on file. PMCM will upload certification documents to your supplier record.</PrismEmptyLine>
        ) : (
          <ul className="divide-y divide-border">
            {certifications.map((cert) => (
              <li key={cert.id} className="flex items-center gap-4 px-5 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <FileCheck2 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{cert.fileName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {cert.documentType ?? "Document"}
                    {cert.issuer ? ` — ${cert.issuer}` : ""}
                    {cert.expiresAt ? ` — Expires ${formatDate(cert.expiresAt)}` : ""}
                  </p>
                </div>
                {cert.status && <StatusBadge status={cert.status} />}
              </li>
            ))}
          </ul>
        )}
      </PrismSection>
    </PrismPageColumn>
  );
}
