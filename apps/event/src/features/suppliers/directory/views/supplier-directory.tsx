"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ChevronDown, Plus, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Button } from "@/app/components/ui/button";
import type { CreateSupplierInput } from "@prism/types";
import type { EventSession } from "@/app/lib/session";
import { SupplierApplicationsInboxView } from "@/features/suppliers/applications";
import { useSupplierDirectoryViewModel } from "../view-models/use-supplier-directory-view-model";
import { SupplierDetailDrawer } from "./supplier-detail-drawer";
import { SupplierDirectoryTable } from "./supplier-directory-table";
import styles from "./supplier-workspace.module.css";

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
    <div className={styles.workspace}>
      <h1 id="supplier-directory-heading" tabIndex={-1} className="sr-only">Suppliers</h1>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div role="group" aria-label="Supplier tier views" className="flex gap-1 overflow-x-auto">
          {[[undefined, "All suppliers"], ["tier_1", "Tier 1"], ["tier_2", "Tier 2"], ["pending_first_event", "First event pending"]].map(([tier, label]) => <button key={label} type="button" aria-pressed={directory.query.tier === tier} onClick={() => directory.updateQuery({ tier: tier as typeof directory.query.tier, page: 0 })} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${directory.query.tier === tier ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>{label}</button>)}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" aria-expanded={applicationsOpen} aria-controls="supplier-applications-panel" onClick={() => setApplicationsOpen((open) => !open)}><Users className="size-3.5" />Applications<ChevronDown className={`size-3.5 ${applicationsOpen ? "rotate-180" : ""}`} /></Button>
          <Button type="button" size="sm" disabled={Boolean(directory.actionResult?.saved && directory.actionResult.refreshFailed)} onClick={() => setCreateOpen((open) => !open)}>{createOpen ? "Cancel" : <><Plus className="size-3.5" />New supplier</>}</Button>
        </div>
      </div>

      {directory.actionResult?.saved && directory.actionResult.refreshFailed && !directory.selectedSupplierId ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-sm"><span>Saved. Refresh failed.</span><Button type="button" variant="outline" size="sm" onClick={() => { void directory.refresh().catch(() => undefined); }}>Retry refresh</Button></div>
      ) : null}

      {createOpen ? (
        <form onSubmit={(event) => void createSupplier(event)} className="grid gap-3 border-b border-border bg-card p-5 md:grid-cols-2">
          <label className="grid gap-1 text-xs text-muted-foreground">Supplier name<input required value={createForm.name} onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Category<select required value={createForm.categoryId} onChange={(event) => setCreateForm({ ...createForm, categoryId: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="">Choose category</option>{directory.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Contact name<input value={createForm.contactName ?? ""} onChange={(event) => setCreateForm({ ...createForm, contactName: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Email<input type="email" value={createForm.email ?? ""} onChange={(event) => setCreateForm({ ...createForm, email: event.target.value || undefined })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Phone<input value={createForm.phone ?? ""} onChange={(event) => setCreateForm({ ...createForm, phone: event.target.value || undefined })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label>
          <label className="grid gap-1 text-xs text-muted-foreground">Initial tier<select value={createForm.tier ?? "pending_first_event"} onChange={(event) => setCreateForm({ ...createForm, tier: event.target.value as CreateSupplierInput["tier"] })} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="pending_first_event">Pending first event</option><option value="tier_1">Tier 1</option><option value="tier_2">Tier 2</option></select></label>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2"><Button type="submit" disabled={directory.actionSaving || (directory.actionResult?.saved && directory.actionResult.refreshFailed) || !createForm.name.trim() || !createForm.categoryId}>Create supplier</Button>{directory.actionResult && !directory.actionResult.saved ? <span role="alert" className="text-xs text-destructive">{directory.actionResult.message}</span> : null}</div>
        </form>
      ) : null}

      {applicationsOpen ? <div id="supplier-applications-panel" className="border-b border-border bg-card p-5"><SupplierApplicationsInboxView /></div> : null}

      {directory.categoriesError && !directory.categoriesLoaded ? <Alert variant="destructive"><AlertDescription>{directory.categoriesError}</AlertDescription></Alert> : null}

      <SupplierDirectoryTable
        directory={directory.directory}
        categories={directory.categories}
        query={directory.query}
        searchDraft={directory.searchDraft}
        loading={directory.directoryLoading}
        error={directory.directoryError}
        view={directory.view}
        selectedSupplierId={directory.selectedSupplierId}
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
