import { ShieldCheck } from "lucide-react";
import type { PrismApprovalRequest } from "@prism/types";
import { PrismSectionPanel } from "@prism/ui";
import { Button } from "@/app/components/ui/button";
import { EmptyState } from "@/app/components/ui/empty-state";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { label } from "@/features/pmcm-kit";

export function AdminApprovalsPanel({
  approvals,
  busy,
  onApprove,
  onDecline,
}: {
  approvals: PrismApprovalRequest[];
  busy: boolean;
  onApprove: (request: PrismApprovalRequest) => Promise<void>;
  onDecline: (request: PrismApprovalRequest) => Promise<void>;
}) {
  return (
    <PrismSectionPanel title="Admin approvals" icon={ShieldCheck}>
      {approvals.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No pending approvals"
          description="New account requests will appear here for review."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {approvals.map((request) => (
            <div key={request.id} className="rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{request.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{request.email}</p>
                  <p className="mt-1.5 text-3xs font-black uppercase tracking-[0.14em] text-attention">
                    {label(request.role)} - {request.organization}
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => onApprove(request)}
                  className="rounded-lg font-bold"
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onDecline(request)}
                  className="rounded-lg font-bold"
                >
                  Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PrismSectionPanel>
  );
}
