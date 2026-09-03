"use client";

import { FileCheck2, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { formatDate } from "../../model/supplier-workspace-rules";
import type { PrismAuthenticatedSession } from "@prism/types";
import type { SupplierWorkspace } from "../../model/supplier-workspace-types";
import { Card, CardBody, CardHeader } from "./shell-ui";
import { SupplierFileRequirementsMatrix } from "./supplier-file-requirements-matrix";

export function FilesPage({
  workspace,
  session,
}: {
  workspace: SupplierWorkspace;
  session: PrismAuthenticatedSession;
}) {
  const fileRequests = workspace.quoteRequests.filter((r) => r.contractDocumentId);

  return (
    <div className="space-y-4">
      <SupplierFileRequirementsMatrix workspace={workspace} session={session} />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Contract files</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Contract metadata saved for each booking. Full documents are managed by PMCM.</p>
        </CardHeader>
        {fileRequests.length === 0 ? (
          <CardBody>
            <EmptyState icon={FileCheck2} title="No contract files saved." description="Save contract metadata in the Bookings section after PMCM selects your quote." />
          </CardBody>
        ) : (
          <div className="divide-y divide-border">
            {fileRequests.map((req) => (
              <div key={req.id} className="flex items-center gap-4 px-6 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-(--prism-signal)">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{req.contractDocumentId}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{req.category}</p>
                </div>
                <Badge variant="outline" className="rounded-full border-(--prism-success)/25 bg-(--prism-success)/8 text-[10px] text-(--prism-success)">Saved</Badge>
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

