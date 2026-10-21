import { ArrowLeft, Check, FilePlus2, Plus, Search } from "lucide-react";

import type { PrismSupplier, PrismSupplierCategory } from "@prism/types";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { cx, RatingStars, SupplierTierBadge } from "@/features/pmcm-kit";
import {
  SupplierReviewPanel,
  buildSupplierAssessmentInput,
  describeSupplierAssessment,
  type SupplierReviewForm,
} from "@/features/suppliers/reviews";
import { supplierContactFallback } from "../model/suppliers-directory-rules";

export type SupplierCreateForm = {
  categoryId: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  tier: "tier_1" | "tier_2" | "pending_first_event";
  serviceInclusions: string;
  performanceNotes: string;
};

export type SupplierEditForm = {
  name: string;
  contactName: string;
  email: string;
  phone: string;
  serviceInclusions: string;
  performanceNotes: string;
};

export type SupplierTierForm = {
  tier: "tier_1" | "tier_2" | "pending_first_event";
  reason: string;
};

export type SupplierCertForm = {
  fileName: string;
  documentType: string;
  issuer: string;
  expiresAt: string;
  status: "submitted" | "verified" | "expired" | "rejected";
  notes: string;
};

export function SupplierDirectoryList({
  suppliers,
  filtered,
  categories,
  query,
  categoryId,
  tier,
  rating,
  selectedSupplierId,
  showCreate,
  createForm,
  busy,
  onQuery,
  onCategoryId,
  onTier,
  onRating,
  onSelect,
  onToggleCreate,
  onCreateForm,
  onSubmitCreate,
}: {
  suppliers: PrismSupplier[];
  filtered: PrismSupplier[];
  categories: PrismSupplierCategory[];
  query: string;
  categoryId: string;
  tier: string;
  rating: string;
  selectedSupplierId: string | null;
  showCreate: boolean;
  createForm: SupplierCreateForm;
  busy: boolean;
  onQuery: (value: string) => void;
  onCategoryId: (value: string) => void;
  onTier: (value: string) => void;
  onRating: (value: string) => void;
  onSelect: (id: string) => void;
  onToggleCreate: () => void;
  onCreateForm: (patch: Partial<SupplierCreateForm>) => void;
  onSubmitCreate: () => void;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-primary/12 bg-card p-4 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">Supplier Directory</p>
          <h2 className="mt-2 text-2xl font-black">PMCM supplier database</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Eight configurable categories, tier tags, BNI auto-trust, reviews, and reliability history.
          </p>
        </div>
        <div className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-black">
          {suppliers.length} suppliers
        </div>
        <button
          type="button"
          onClick={onToggleCreate}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground"
        >
          <Plus className="size-4" /> Add supplier
        </button>
      </div>

      {showCreate && (
        <SupplierCreateFormFields
          createForm={createForm}
          categories={categories}
          busy={busy}
          onCreateForm={onCreateForm}
          onSubmitCreate={onSubmitCreate}
        />
      )}

      <div className="mt-5 grid gap-2 lg:grid-cols-[minmax(220px,1fr)_180px_160px_160px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            className="h-10 bg-white pl-9"
            placeholder="Search supplier name, contact, email..."
          />
        </div>
        <select value={categoryId} onChange={(event) => onCategoryId(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <select value={tier} onChange={(event) => onTier(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
          <option value="all">All tiers</option>
          <option value="tier_1">Tier 1</option>
          <option value="tier_2">Tier 2</option>
          <option value="pending_first_event">Pending First Event</option>
        </select>
        <select value={rating} onChange={(event) => onRating(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
          <option value="all">All ratings</option>
          <option value="4.5">4.5 and up</option>
          <option value="4.0">4.0 and up</option>
          <option value="unrated">Unrated</option>
        </select>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <div className="grid min-w-[1040px] grid-cols-[minmax(260px,1.6fr)_minmax(160px,1fr)_9rem_7rem_10rem_8rem] gap-4 border-b border-border bg-secondary/45 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
            <span>Name</span>
            <span>Category</span>
            <span>Tier</span>
            <span>BNI</span>
            <span>Aggregate Rating</span>
            <span>Last Event</span>
          </div>
          <div className="max-h-[560px] min-w-[1040px] overflow-y-auto">
            {filtered.map((supplier) => (
              <SupplierDirectoryRow
                key={supplier.id}
                supplier={supplier}
                selected={supplier.id === selectedSupplierId}
                onSelect={onSelect}
              />
            ))}
            {filtered.length === 0 && (
              <div className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No suppliers match the active filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SupplierCreateFormFields({
  createForm,
  categories,
  busy,
  onCreateForm,
  onSubmitCreate,
}: {
  createForm: SupplierCreateForm;
  categories: PrismSupplierCategory[];
  busy: boolean;
  onCreateForm: (patch: Partial<SupplierCreateForm>) => void;
  onSubmitCreate: () => void;
}) {
  return (
    <div className="mt-5 rounded-lg border border-border bg-muted p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">New supplier</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <Input value={createForm.name} onChange={(event) => onCreateForm({ name: event.target.value })} className="h-10 bg-white" placeholder="Supplier name" />
        <Input value={createForm.contactName} onChange={(event) => onCreateForm({ contactName: event.target.value })} className="h-10 bg-white" placeholder="Contact person" />
        <Input value={createForm.email} onChange={(event) => onCreateForm({ email: event.target.value })} className="h-10 bg-white" placeholder="Email" />
        <Input value={createForm.phone} onChange={(event) => onCreateForm({ phone: event.target.value })} className="h-10 bg-white" placeholder="Phone" />
        <select value={createForm.categoryId} onChange={(event) => onCreateForm({ categoryId: event.target.value })} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select value={createForm.tier} onChange={(event) => onCreateForm({ tier: event.target.value as SupplierCreateForm["tier"] })} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
          <option value="pending_first_event">Pending First Event</option>
          <option value="tier_1">Tier 1</option>
          <option value="tier_2">Tier 2</option>
        </select>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <textarea value={createForm.serviceInclusions} onChange={(event) => onCreateForm({ serviceInclusions: event.target.value })} className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Service inclusions" />
        <textarea value={createForm.performanceNotes} onChange={(event) => onCreateForm({ performanceNotes: event.target.value })} className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Private performance notes" />
      </div>
      <button type="button" disabled={busy || !createForm.name.trim()} onClick={onSubmitCreate} className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">
        <Check className="size-4" /> Save supplier
      </button>
    </div>
  );
}

function SupplierDirectoryRow({
  supplier,
  selected,
  onSelect,
}: {
  supplier: PrismSupplier;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(supplier.id)}
      className={cx(
        "grid w-full grid-cols-[minmax(260px,1.6fr)_minmax(160px,1fr)_9rem_7rem_10rem_8rem] items-center gap-4 border-b border-border px-4 py-4 text-left text-sm transition last:border-b-0 hover:bg-secondary/55 focus-visible:bg-secondary focus-visible:outline-none",
        selected && "bg-secondary",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-black text-foreground">{supplier.name}</span>
        <span className="mt-1 block truncate text-xs font-medium text-muted-foreground">{supplierContactFallback(supplier)}</span>
      </span>
      <span className="truncate font-medium text-muted-foreground">{supplier.categoryName}</span>
      <span>
        <SupplierTierBadge tier={supplier.tier} />
      </span>
      <span>
        {supplier.bniMember ? (
          <Badge variant="outline" className="rounded-full border-[#F06030]/30 bg-accent px-2.5 py-1 text-[11px] font-black text-(--prism-amber)">BNI</Badge>
        ) : (
          <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[11px] font-black text-muted-foreground">No BNI</span>
        )}
      </span>
      <span>
        <RatingStars rating={supplier.aggregateRating} />
      </span>
      <span className="font-medium text-muted-foreground">{supplier.lastEventDate ?? "None"}</span>
    </button>
  );
}

export function SupplierProfile({
  supplier,
  categories,
  editForm,
  tierForm,
  reviewForm,
  reviewDimensionRatings,
  certForm,
  busy,
  onBack,
  onToggleBni,
  onEditForm,
  onSaveProfile,
  onTierForm,
  onSubmitTier,
  onReviewForm,
  onReviewDimension,
  onSubmitReview,
  onCertForm,
  onSubmitCertification,
  onOpenEvent,
}: {
  supplier: PrismSupplier;
  categories: PrismSupplierCategory[];
  editForm: SupplierEditForm;
  tierForm: SupplierTierForm;
  reviewForm: SupplierReviewForm;
  reviewDimensionRatings: Record<string, string>;
  certForm: SupplierCertForm;
  busy: boolean;
  onBack: () => void;
  onToggleBni: () => void;
  onEditForm: (patch: Partial<SupplierEditForm>) => void;
  onSaveProfile: () => void;
  onTierForm: (patch: Partial<SupplierTierForm>) => void;
  onSubmitTier: () => void;
  onReviewForm: (patch: Partial<SupplierReviewForm>) => void;
  onReviewDimension: (dimensionId: string, value: string) => void;
  onSubmitReview: () => void;
  onCertForm: (patch: Partial<SupplierCertForm>) => void;
  onSubmitCertification: () => void;
  onOpenEvent: (eventId: string) => void;
}) {
  const activeReviewDimensions = categories.find((category) => category.id === supplier.categoryId)?.reviewDimensions ?? [];
  const assessment = describeSupplierAssessment(buildSupplierAssessmentInput({
    draft: reviewForm,
    dimensionRatings: reviewDimensionRatings,
    dimensions: activeReviewDimensions,
  }));

  return (
    <section className="rounded-lg border border-primary/12 bg-card p-5 shadow-none">
      <div className="space-y-5">
        <SupplierProfileHeader supplier={supplier} onBack={onBack} />
        <SupplierBniPanel supplier={supplier} busy={busy} onToggleBni={onToggleBni} />
        <SupplierEditProfileForm editForm={editForm} busy={busy} onEditForm={onEditForm} onSaveProfile={onSaveProfile} />
        <SupplierTierChangeForm tierForm={tierForm} busy={busy} onTierForm={onTierForm} onSubmitTier={onSubmitTier} />
        <SupplierReviewPanel
          reviewForm={reviewForm}
          reviewDimensionRatings={reviewDimensionRatings}
          dimensions={activeReviewDimensions}
          busy={busy}
          onReviewForm={onReviewForm}
          onReviewDimension={onReviewDimension}
          onSubmitReview={onSubmitReview}
          canSubmit={assessment.canSubmit}
          missingDimensionNames={assessment.missingDimensionNames}
          validationMessage={assessment.validationMessage}
        />
        <SupplierCertificationForm certForm={certForm} busy={busy} onCertForm={onCertForm} onSubmitCertification={onSubmitCertification} />
        <SupplierFacts supplier={supplier} />
        <SupplierPastEvents supplier={supplier} onOpenEvent={onOpenEvent} />
        <SupplierReliabilityNotes supplier={supplier} />
        <SupplierCertificationList supplier={supplier} />
      </div>
    </section>
  );
}

function SupplierProfileHeader({ supplier, onBack }: { supplier: PrismSupplier; onBack: () => void }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">Supplier Profile</p>
          <h3 className="mt-2 truncate text-2xl font-black">{supplier.name}</h3>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-border bg-white px-3 text-xs font-black text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Supplier list
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <SupplierTierBadge tier={supplier.tier} />
        <Badge variant="outline" className="rounded-full bg-secondary">{supplier.categoryName}</Badge>
        {supplier.autoTrust && (
          <Badge variant="outline" className="rounded-full border-[#F06030]/30 bg-accent text-(--prism-amber)">Auto-Trust</Badge>
        )}
      </div>
    </div>
  );
}

function SupplierBniPanel({
  supplier,
  busy,
  onToggleBni,
}: {
  supplier: PrismSupplier;
  busy: boolean;
  onToggleBni: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-black">BNI Member</p>
          <p className="mt-1 text-xs text-muted-foreground">Toggling this enables the system Auto-Trust flag.</p>
        </div>
        <button
          disabled={busy}
          onClick={onToggleBni}
          className={cx(
            "h-9 rounded-full px-4 text-xs font-black",
            supplier.bniMember ? "bg-(--prism-ink) text-sidebar-foreground" : "border border-border bg-white text-foreground",
          )}
        >
          {supplier.bniMember ? "BNI On" : "BNI Off"}
        </button>
      </div>
    </div>
  );
}

function SupplierEditProfileForm({
  editForm,
  busy,
  onEditForm,
  onSaveProfile,
}: {
  editForm: SupplierEditForm;
  busy: boolean;
  onEditForm: (patch: Partial<SupplierEditForm>) => void;
  onSaveProfile: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">Edit Profile</p>
      <div className="mt-3 grid gap-2">
        <Input value={editForm.name} onChange={(event) => onEditForm({ name: event.target.value })} className="h-10 bg-white" placeholder="Supplier name" />
        <Input value={editForm.contactName} onChange={(event) => onEditForm({ contactName: event.target.value })} className="h-10 bg-white" placeholder="Contact person" />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={editForm.email} onChange={(event) => onEditForm({ email: event.target.value })} className="h-10 bg-white" placeholder="Email" />
          <Input value={editForm.phone} onChange={(event) => onEditForm({ phone: event.target.value })} className="h-10 bg-white" placeholder="Phone" />
        </div>
        <textarea value={editForm.serviceInclusions} onChange={(event) => onEditForm({ serviceInclusions: event.target.value })} className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Service inclusions" />
        <textarea value={editForm.performanceNotes} onChange={(event) => onEditForm({ performanceNotes: event.target.value })} className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Private PMCM performance notes" />
      </div>
      <button type="button" disabled={busy || !editForm.name.trim()} onClick={onSaveProfile} className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60">
        <Check className="size-4" /> Save profile
      </button>
    </div>
  );
}

function SupplierTierChangeForm({
  tierForm,
  busy,
  onTierForm,
  onSubmitTier,
}: {
  tierForm: SupplierTierForm;
  busy: boolean;
  onTierForm: (patch: Partial<SupplierTierForm>) => void;
  onSubmitTier: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">Tier Change</p>
      <div className="mt-3 grid gap-2">
        <select value={tierForm.tier} onChange={(event) => onTierForm({ tier: event.target.value as SupplierTierForm["tier"] })} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
          <option value="tier_1">Tier 1</option>
          <option value="tier_2">Tier 2</option>
          <option value="pending_first_event">Pending First Event</option>
        </select>
        <textarea value={tierForm.reason} onChange={(event) => onTierForm({ reason: event.target.value })} className="min-h-16 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Required reason for audit trail" />
      </div>
      <button type="button" disabled={busy || !tierForm.reason.trim()} onClick={onSubmitTier} className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60">
        <Check className="size-4" /> Change tier
      </button>
    </div>
  );
}

function SupplierCertificationForm({
  certForm,
  busy,
  onCertForm,
  onSubmitCertification,
}: {
  certForm: SupplierCertForm;
  busy: boolean;
  onCertForm: (patch: Partial<SupplierCertForm>) => void;
  onSubmitCertification: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">Certification Metadata</p>
      <div className="mt-3 grid gap-2">
        <Input value={certForm.fileName} onChange={(event) => onCertForm({ fileName: event.target.value })} className="h-10 bg-white" placeholder="File name" />
        <Input value={certForm.documentType} onChange={(event) => onCertForm({ documentType: event.target.value })} className="h-10 bg-white" placeholder="Document type" />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={certForm.issuer} onChange={(event) => onCertForm({ issuer: event.target.value })} className="h-10 bg-white" placeholder="Issuer" />
          <Input type="date" value={certForm.expiresAt} onChange={(event) => onCertForm({ expiresAt: event.target.value })} className="h-10 bg-white" />
        </div>
        <select value={certForm.status} onChange={(event) => onCertForm({ status: event.target.value as SupplierCertForm["status"] })} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
          <option value="submitted">Submitted</option>
          <option value="verified">Verified</option>
          <option value="expired">Expired</option>
          <option value="rejected">Rejected</option>
        </select>
        <textarea value={certForm.notes} onChange={(event) => onCertForm({ notes: event.target.value })} className="min-h-16 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Metadata notes" />
      </div>
      <button type="button" disabled={busy || !certForm.fileName.trim() || !certForm.documentType.trim()} onClick={onSubmitCertification} className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60">
        <FilePlus2 className="size-4" /> Add certification
      </button>
    </div>
  );
}

function SupplierFacts({ supplier }: { supplier: PrismSupplier }) {
  return (
    <div className="grid gap-3 text-sm">
      <div className="rounded-md bg-background p-3">
        <p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Contact</p>
        <p className="mt-1 font-semibold">{supplier.contactName || "No contact person"}</p>
        <p className="text-muted-foreground">{supplier.email || "No email"} - {supplier.phone || "No phone"}</p>
      </div>
      <div className="rounded-md bg-background p-3">
        <p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Internal Rating</p>
        <div className="mt-2"><RatingStars rating={supplier.aggregateRating} /></div>
      </div>
      <div className="rounded-md bg-background p-3">
        <p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Service Inclusions</p>
        <p className="mt-1 leading-6 text-muted-foreground">{supplier.serviceInclusions}</p>
      </div>
      <div className="rounded-md bg-background p-3">
        <p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Performance Notes</p>
        <p className="mt-1 leading-6 text-muted-foreground">{supplier.performanceNotes}</p>
      </div>
    </div>
  );
}

function SupplierPastEvents({
  supplier,
  onOpenEvent,
}: {
  supplier: PrismSupplier;
  onOpenEvent: (eventId: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Past Events</p>
      <div className="mt-2 space-y-2">
        {supplier.pastEvents.length === 0 && <p className="text-sm text-muted-foreground">No linked event records yet.</p>}
        {supplier.pastEvents.map((event) => (
          <button key={event.id} onClick={() => onOpenEvent(event.id)} className="w-full rounded-md border border-border bg-white p-3 text-left text-sm hover:border-primary/40">
            <span className="block font-black">{event.eventName}</span>
            <span className="text-muted-foreground">{event.clientName} - {event.eventDate}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SupplierReliabilityNotes({ supplier }: { supplier: PrismSupplier }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reliability Notes</p>
      <div className="mt-2 space-y-2">
        {supplier.reliabilityNotes.map((note) => (
          <div key={note.id} className="rounded-md bg-background p-3 text-sm">
            <p>{note.note}</p>
            <p className="mt-1 text-xs text-muted-foreground">{note.eventName ?? "Directory note"} - {note.createdAt.slice(0, 10)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SupplierCertificationList({ supplier }: { supplier: PrismSupplier }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Certifications Uploaded</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {supplier.certifications.map((certification) => (
          <SupplierCertificationChip key={certification.id} certification={certification} />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Application date: {supplier.applicationDate}</p>
    </div>
  );
}

function SupplierCertificationChip({ certification }: { certification: PrismSupplier["certifications"][number] }) {
  return (
    <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold">
      {certification.fileName}
      {certification.documentType ? ` - ${certification.documentType}` : ""}
      {certification.status ? ` (${certification.status})` : ""}
    </span>
  );
}
