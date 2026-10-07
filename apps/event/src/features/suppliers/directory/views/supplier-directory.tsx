"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import type { CreateSupplierInput } from "@prism/types";
import type { EventSession } from "@/app/lib/session";
import { SupplierApplicationsInboxView } from "@/features/suppliers/applications";
import { useSupplierDirectoryViewModel } from "../view-models/use-supplier-directory-view-model";
import { SupplierDetailDrawer } from "./supplier-detail-drawer";
import { SupplierDirectoryTable } from "./supplier-directory-table";

export function SupplierDirectory({
  view,
  session,
  onOpenEvent,
}: {
  view: string;
  session: EventSession | null;
  onOpenEvent: (eventId: string) => void;
}) {
  const directory = useSupplierDirectoryViewModel({ view, session });
  const [applicationsOpen, setApplicationsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateSupplierInput>({ categoryId: "", name: "", tier: "pending_first_event" });
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const previousSupplierId = useRef<string | null>(null);

  useEffect(() => {
    if (previousSupplierId.current && !directory.selectedSupplierId) {
      window.setTimeout(() => {
        const opener = returnFocusRef.current;
        if (opener?.isConnected) opener.focus();
        else document.getElementById("supplier-directory-heading")?.focus();
      }, 0);
    }
    previousSupplierId.current = directory.selectedSupplierId;
  }, [directory.selectedSupplierId]);

  useEffect(() => {
    if (!createForm.categoryId && directory.categories[0]?.id) setCreateForm((form) => ({ ...form, categoryId: directory.categories[0].id }));
  }, [createForm.categoryId, directory.categories]);

  async function createSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await directory.submitAction({ kind: "create", input: createForm });
    if (result.saved) {
      setCreateForm({ categoryId: directory.categories[0]?.id ?? "", name: "", tier: "pending_first_event" });
      setCreateOpen(false);
    }
  }

  if (!directory.canRead) {
    return <Alert variant="destructive"><AlertDescription>Supplier workspace access requires a signed-in PMCM account.</AlertDescription></Alert>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 id="supplier-directory-heading" tabIndex={-1} className="text-lg font-semibold outline-none">Supplier directory</h1><p className="mt-1 text-sm text-muted-foreground">{directory.directory ? `${directory.directory.totalCount} suppliers in the PMCM network` : "Manage supplier records, event history and performance."}</p></div>
        <Button type="button" disabled={Boolean(directory.actionResult?.saved && directory.actionResult.refreshFailed)} onClick={() => setCreateOpen((open) => !open)}>{createOpen ? "Cancel" : "New supplier"}</Button>
      </div>

      {directory.actionResult?.saved && directory.actionResult.refreshFailed && !directory.selectedSupplierId ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm"><span>Saved. Refresh failed.</span><Button type="button" variant="outline" size="sm" onClick={() => { void directory.refresh().catch(() => undefined); }}>Retry refresh</Button></div>
      ) : null}

      {createOpen ? (
        <form onSubmit={(event) => void createSupplier(event)} className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-2">
          <label className="grid gap-1 text-xs text-muted-foreground">Supplier name<input required value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Category<select required value={createForm.categoryId} onChange={(event) => setCreateForm({ ...createForm, categoryId: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="">Choose category</option>{directory.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Contact name<input value={createForm.contactName ?? ""} onChange={(event) => setCreateForm({ ...createForm, contactName: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Email<input type="email" value={createForm.email ?? ""} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value || undefined })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Phone<input value={createForm.phone ?? ""} onChange={(event) => setCreateForm({ ...createForm, phone: event.target.value || undefined })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Initial tier<select value={createForm.tier ?? "pending_first_event"} onChange={(event) => setCreateForm({ ...createForm, tier: event.target.value as CreateSupplierInput["tier"] })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="pending_first_event">Pending first event</option><option value="tier_1">Tier 1</option><option value="tier_2">Tier 2</option></select></label>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2"><Button type="submit" disabled={directory.actionSaving || (directory.actionResult?.saved && directory.actionResult.refreshFailed) || !createForm.name.trim() || !createForm.categoryId}>Create supplier</Button>{directory.actionResult && !directory.actionResult.saved ? <span role="alert" className="text-xs text-destructive">{directory.actionResult.message}</span> : null}</div>
        </form>
      ) : null}

      <details
        className="rounded-xl border border-border bg-card"
        open={applicationsOpen}
        onToggle={(event) => setApplicationsOpen(event.currentTarget.open)}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
          {applicationsOpen ? <ChevronDown aria-hidden="true" className="size-4" /> : <ChevronRight aria-hidden="true" className="size-4" />}
          Supplier applications
        </summary>
        {applicationsOpen ? <div className="border-t border-border p-4"><SupplierApplicationsInboxView /></div> : null}
      </details>

      {directory.categoriesError && !directory.categoriesLoaded ? <Alert variant="destructive"><AlertDescription>{directory.categoriesError}</AlertDescription></Alert> : null}

      <SupplierDirectoryTable
        directory={directory.directory}
        categories={directory.categories}
        query={directory.query}
        searchDraft={directory.searchDraft}
        loading={directory.directoryLoading}
        error={directory.directoryError}
        view={directory.view}
        onSearch={directory.setSearchDraft}
        onQueryChange={directory.updateQuery}
        onSelectSupplier={(supplierId, trigger) => {
          returnFocusRef.current = trigger;
          directory.openSupplier(supplierId);
        }}
        onRefresh={() => { void directory.refresh().catch(() => undefined); }}
        onRetry={() => { void directory.refresh().catch(() => undefined); }}
      />

      {directory.selectedSupplierId ? (
        <SupplierDetailDrawer
          key={`${session?.id ?? ""}:${directory.selectedSupplierId}`}
          supplierId={directory.selectedSupplierId}
          profile={directory.profile}
          profileLoading={directory.profileLoading}
          profileError={directory.profileError}
          categories={directory.categories}
          engagements={directory.engagements}
          engagementsLoading={directory.engagementsLoading}
          engagementsError={directory.engagementsError}
          reviews={directory.reviews}
          reviewsLoading={directory.reviewsLoading}
          certifications={directory.certifications}
          certificationsLoading={directory.certificationsLoading}
          records={directory.records}
          recordsLoading={directory.recordsLoading}
          recordsError={directory.recordsError}
          profilePeriod={directory.profilePeriod}
          recordsPeriod={directory.recordsPeriod}
          engagementPage={directory.engagementPage}
          actionSaving={directory.actionSaving}
          actionResult={directory.actionResult}
          onClose={directory.closeSupplier}
          onRetry={() => { void directory.refresh().catch(() => undefined); }}
          onOpenEvent={onOpenEvent}
          onProfilePeriodChange={directory.setProfilePeriod}
          onRecordsPeriodChange={directory.setRecordsPeriod}
          onEngagementPageChange={directory.setEngagementPage}
          onSubmitAction={directory.submitAction}
        />
      ) : null}

      {directory.categoriesError && directory.categoriesLoaded ? <p className="text-xs text-muted-foreground">Category filters could not be loaded. Directory results are still available.</p> : null}
    </div>
  );
}
