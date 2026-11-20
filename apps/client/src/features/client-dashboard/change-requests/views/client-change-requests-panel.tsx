"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { FilePen } from "lucide-react";
import { formatPortalDate } from "@prism/ui/format-date";
import { Button } from "@prism/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@prism/ui/components/dialog";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Input } from "@prism/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { Textarea } from "@prism/ui/components/textarea";
import { LoadingState } from "@prism/ui/components/loading-state";
import { PrismEmptyLine, PrismSection } from "@prism/ui/page-blocks";
import type { PrismClientChangeRequest, ScopeChangeCategory, SubmitScopeChangeRequestInput } from "@prism/types";
import { ClientListRow, type ClientRowTone } from "../../shared/client-list-ui";
import { canWithdrawClientChangeRequest, clientChangeRequestStatusLabel, scopeChangeCategoryOptions } from "../model/client-change-request-rules";
import { useClientChangeRequestsViewModel } from "../view-models/use-client-change-requests-view-model";

const STATUS_TONE: Record<PrismClientChangeRequest["status"], ClientRowTone> = {
  under_review: "neutral",
  approved: "done",
  not_approved: "neutral",
  withdrawn: "neutral",
};

const categoryLabel = (category: PrismClientChangeRequest["category"]) =>
  scopeChangeCategoryOptions.find((option) => option.value === category)?.label;

/**
 * The client's change requests: one heading with the screen's one button, the line on when changes close, and one
 * row per request. A row opens the request, where PMCM's answer is read and a request under review can be withdrawn.
 */
export function ClientChangeRequestsPanel({ eventId, notice, canRequest = true }: { eventId: string; notice?: ReactNode; canRequest?: boolean }) {
  const vm = useClientChangeRequestsViewModel(eventId);
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const opened = vm.requests.find((request) => request.id === openId) ?? null;

  return (
    <div className="space-y-3">
      <PrismSection
        id="client-change-requests-heading"
        title="Change requests"
        count={vm.status === "ready" && vm.requests.length > 0 ? vm.requests.length : undefined}
        description={notice}
        headerOutside
        flush={vm.status === "ready" && vm.requests.length > 0}
        action={vm.status === "ready" && canRequest ? <Button type="button" onClick={() => setFormOpen(true)}>Request a change</Button> : undefined}
      >
        <ChangeRequestList vm={vm} onOpen={setOpenId} />
      </PrismSection>
      <ScopeChangeDialog
        open={formOpen}
        busy={vm.busy}
        error={formOpen ? vm.error : null}
        onClose={() => setFormOpen(false)}
        onSubmit={async (draft) => {
          const saved = await vm.submitScopeChange(draft);
          if (saved) setFormOpen(false);
          return saved;
        }}
      />
      <ChangeRequestDialog
        request={opened}
        busy={vm.busy}
        error={opened ? vm.error : null}
        onClose={() => setOpenId(null)}
        onWithdraw={async (id) => { if (await vm.withdrawScopeChange(id)) setOpenId(null); }}
      />
    </div>
  );
}

type ChangeRequestsVm = ReturnType<typeof useClientChangeRequestsViewModel>;

function ChangeRequestList({ vm, onOpen }: { vm: ChangeRequestsVm; onOpen: (id: string) => void }) {
  if (vm.status === "loading") return <LoadingState label="Loading change requests…" />;
  if (vm.status === "error") return <p role="alert" className="text-sm text-destructive">{vm.error}</p>;
  if (vm.requests.length === 0) {
    return <PrismEmptyLine icon={FilePen}>You haven&apos;t asked for any changes. Ask PMCM here when something about the event should change.</PrismEmptyLine>;
  }
  return (
    <ul className="divide-y divide-border">
      {vm.requests.map((request) => (
        <ClientListRow
          key={request.id}
          icon={FilePen}
          tone={STATUS_TONE[request.status]}
          title={request.requestedChange}
          meta={[categoryLabel(request.category), `Updated ${formatPortalDate(request.updatedAt)}`].filter(Boolean).join(" · ")}
          detail={request.clientResponse ? <span className="text-muted-foreground">PMCM: {request.clientResponse}</span> : undefined}
          status={clientChangeRequestStatusLabel(request.status)}
          action="View"
          onOpen={() => onOpen(request.id)}
        />
      ))}
    </ul>
  );
}

function ChangeRequestDialog({ request, busy, error, onClose, onWithdraw }: {
  request: PrismClientChangeRequest | null;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onWithdraw: (id: string) => Promise<void>;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {request ? (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{request.requestedChange}</DialogTitle>
            <DialogDescription>
              {clientChangeRequestStatusLabel(request.status)} · Updated {formatPortalDate(request.updatedAt)}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-foreground">
            {request.clientResponse
              ? <><span className="font-semibold">PMCM&apos;s answer:</span> {request.clientResponse}</>
              : request.status === "under_review" ? "PMCM is reviewing this request and will answer here." : "PMCM closed this request without a note."}
          </p>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            {canWithdrawClientChangeRequest(request) ? (
              <Button type="button" variant="outline" disabled={busy} onClick={() => void onWithdraw(request.id)}>
                {busy ? "Withdrawing…" : "Withdraw request"}
              </Button>
            ) : null}
            <Button type="button" onClick={onClose}>Close</Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function ScopeChangeDialog({ open, busy, error, onSubmit, onClose }: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (draft: SubmitScopeChangeRequestInput) => Promise<boolean>;
  onClose: () => void;
}) {
  const ids = useId();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ScopeChangeCategory>("other");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSubmit({ title, description, category });
    if (saved) { setTitle(""); setDescription(""); setCategory("other"); }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a change</DialogTitle>
          <DialogDescription>PMCM reviews it and tells you whether it changes the price or the plan.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field>
            <FieldLabel htmlFor={`${ids}-title`}>What would you like to change?</FieldLabel>
            <Input id={`${ids}-title`} required value={title} onChange={(event) => setTitle(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${ids}-details`}>Details</FieldLabel>
            <Textarea id={`${ids}-details`} required value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${ids}-area`}>Area</FieldLabel>
            <Select
              value={category}
              onValueChange={(value) => {
                const option = scopeChangeCategoryOptions.find((candidate) => candidate.value === value);
                if (option) setCategory(option.value);
              }}
            >
              <SelectTrigger id={`${ids}-area`} className="w-full min-w-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopeChangeCategoryOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || !title.trim() || !description.trim()}>{busy ? "Sending…" : "Send request"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
