"use client";

import { FileCheck2, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { formatDate } from "../../model/supplier-workspace-rules";
import type { PrismAuthenticatedSession } from "@prism/types";
import type { PrismSupplierWorkflowWorkspace } from "@prism/types";
import type { SupplierWorkspace } from "../../model/supplier-workspace-types";
import { Card, CardBody, CardHeader } from "./shell-ui";
import { SupplierFileRequirementsMatrix } from "./supplier-file-requirements-matrix";

export function FilesPage({
  workspace,
  session,
  workflowWorkspace,
  onDownloadObject,
}: {
  workspace: SupplierWorkspace;
  session: PrismAuthenticatedSession;
  workflowWorkspace: PrismSupplierWorkflowWorkspace | null;
  onDownloadObject: (objectId: string) => void;
}) {
  const contracts = workflowWorkspace?.contracts ?? [];

  return (
    <div className="space-y-4">
      <SupplierFileRequirementsMatrix workspace={workspace} />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Contract files</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Your uploaded contract versions and PMCM review status.</p>
        </CardHeader>
        {contracts.length === 0 ? (
          <CardBody>
            <EmptyState icon={FileCheck2} title="No contract files uploaded." description="Upload a signed contract from the Bookings section after PMCM selects your quote." />
          </CardBody>
        ) : (
          <div className="divide-y divide-border">
            {contracts.map((contract) => (
              <div key={contract.id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-(--prism-signal)">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">v{contract.version} · {contract.fileName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Uploaded {formatDate(contract.uploadedAt)}{contract.reviewReason ? ` · ${contract.reviewReason}` : ""}</p>
                </div>
                <StatusBadge status={contract.reviewStatus} />
                <button type="button" onClick={() => onDownloadObject(contract.storedObjectId)} className="text-xs font-bold text-(--prism-signal) hover:underline">Download</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Certifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Certifications</h2>
          </div>
        </CardHeader>
        {workspace.supplier.certifications.length === 0 ? (
          <CardBody>
            <EmptyState icon={ShieldCheck} title="No certifications on file." description="PMCM will upload certification documents to your supplier record." />
          </CardBody>
        ) : (
          <div className="divide-y divide-border">
            {workspace.supplier.certifications.map((cert) => (
              <div key={cert.id} className="flex items-center gap-4 px-6 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-(--prism-signal)">
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

