import { useEffect, useState } from "react";
import { Check, FilePlus2, Plus, Search, Star } from "lucide-react";

import type { MvpSupplier, MvpSupplierCategory } from "@/lib/mvp-api";
import { Badge } from "@/app/components/ui/badge";
import { Input } from "@/app/components/ui/input";
import { cx, RatingStars, SupplierTierBadge } from "./helpers";

export function SupplierDirectory({
  categories,
  suppliers,
  onToggleBni,
  onCreateSupplier,
  onUpdateSupplier,
  onChangeTier,
  onAddReview,
  onAddCertification,
  onOpenEvent,
  busy,
}: {
  categories: MvpSupplierCategory[];
  suppliers: MvpSupplier[];
  onToggleBni: (supplier: MvpSupplier, nextValue: boolean) => Promise<void>;
  onCreateSupplier: (input: {
    categoryId: string;
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    tier?: "tier_1" | "tier_2" | "pending_first_event";
    serviceInclusions?: string;
    performanceNotes?: string;
  }) => Promise<void>;
  onUpdateSupplier: (supplierId: string, input: {
    name?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    serviceInclusions?: string;
    performanceNotes?: string;
  }) => Promise<void>;
  onChangeTier: (supplierId: string, tier: "tier_1" | "tier_2" | "pending_first_event", reason: string) => Promise<void>;
  onAddReview: (supplierId: string, input: { rating: number; notes: string; reviewedBy?: string }) => Promise<void>;
  onAddCertification: (supplierId: string, input: {
    fileName: string;
    documentType: string;
    issuer?: string;
    expiresAt?: string;
    status?: "submitted" | "verified" | "expired" | "rejected";
    notes?: string;
  }) => Promise<void>;
  onOpenEvent: (eventId: string) => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [tier, setTier] = useState("all");
  const [rating, setRating] = useState("all");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(suppliers[0]?.id ?? null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    categoryId: categories[0]?.id ?? "",
    name: "",
    contactName: "",
    email: "",
    phone: "",
    tier: "pending_first_event" as "tier_1" | "tier_2" | "pending_first_event",
    serviceInclusions: "",
    performanceNotes: "",
  });
  const [editForm, setEditForm] = useState({ name: "", contactName: "", email: "", phone: "", serviceInclusions: "", performanceNotes: "" });
  const [tierForm, setTierForm] = useState({ tier: "pending_first_event" as "tier_1" | "tier_2" | "pending_first_event", reason: "" });
  const [reviewForm, setReviewForm] = useState({ rating: "4", notes: "" });
  const [certForm, setCertForm] = useState({
    fileName: "",
    documentType: "",
    issuer: "",
    expiresAt: "",
    status: "submitted" as "submitted" | "verified" | "expired" | "rejected",
    notes: "",
  });

  useEffect(() => {
    if (!selectedSupplierId || suppliers.some((supplier) => supplier.id === selectedSupplierId)) return;
    setSelectedSupplierId(suppliers[0]?.id ?? null);
  }, [selectedSupplierId, suppliers]);

  const filtered = suppliers.filter((supplier) => {
    const haystack = `${supplier.name} ${supplier.categoryName} ${supplier.contactName} ${supplier.email}`.toLowerCase();
    if (query && !haystack.includes(query.trim().toLowerCase())) return false;
    if (categoryId !== "all" && supplier.categoryId !== categoryId) return false;
    if (tier !== "all" && supplier.tier !== tier) return false;
    if (rating === "4.5" && (supplier.aggregateRating ?? 0) < 4.5) return false;
    if (rating === "4.0" && (supplier.aggregateRating ?? 0) < 4) return false;
    if (rating === "unrated" && supplier.aggregateRating !== null) return false;
    return true;
  });
  const selectedSupplier =
    suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? filtered[0] ?? suppliers[0];

  useEffect(() => {
    if (!createForm.categoryId && categories[0]?.id) {
      setCreateForm((current) => ({ ...current, categoryId: categories[0].id }));
    }
  }, [categories, createForm.categoryId]);

  useEffect(() => {
    if (!selectedSupplier) return;
    setEditForm({
      name: selectedSupplier.name,
      contactName: selectedSupplier.contactName,
      email: selectedSupplier.email,
      phone: selectedSupplier.phone,
      serviceInclusions: selectedSupplier.serviceInclusions,
      performanceNotes: selectedSupplier.performanceNotes,
    });
    setTierForm({ tier: selectedSupplier.tier as "tier_1" | "tier_2" | "pending_first_event", reason: "" });
    setReviewForm({ rating: "4", notes: "" });
    setCertForm({ fileName: "", documentType: "", issuer: "", expiresAt: "", status: "submitted", notes: "" });
  }, [selectedSupplier?.id]);

  async function submitCreate() {
    if (!createForm.name.trim() || !createForm.categoryId) return;
    await onCreateSupplier(createForm);
    setCreateForm((current) => ({ ...current, name: "", contactName: "", email: "", phone: "", serviceInclusions: "", performanceNotes: "" }));
    setShowCreate(false);
  }

  async function saveProfile() {
    if (!selectedSupplier) return;
    await onUpdateSupplier(selectedSupplier.id, editForm);
  }

  async function submitTierChange() {
    if (!selectedSupplier || !tierForm.reason.trim()) return;
    await onChangeTier(selectedSupplier.id, tierForm.tier, tierForm.reason);
    setTierForm((current) => ({ ...current, reason: "" }));
  }

  async function submitReview() {
    if (!selectedSupplier || !reviewForm.notes.trim()) return;
    await onAddReview(selectedSupplier.id, { rating: Number(reviewForm.rating), notes: reviewForm.notes, reviewedBy: "Ms. Mys" });
    setReviewForm({ rating: "4", notes: "" });
  }

  async function submitCertification() {
    if (!selectedSupplier || !certForm.fileName.trim() || !certForm.documentType.trim()) return;
    await onAddCertification(selectedSupplier.id, certForm);
    setCertForm({ fileName: "", documentType: "", issuer: "", expiresAt: "", status: "submitted", notes: "" });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
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
            onClick={() => setShowCreate((current) => !current)}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground"
          >
            <Plus className="size-4" /> Add supplier
          </button>
        </div>

        {showCreate && (
          <div className="mt-5 rounded-lg border border-border bg-muted p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">New Supplier Profile</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              <Input value={createForm.name} onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))} className="h-10 bg-white" placeholder="Supplier name" />
              <Input value={createForm.contactName} onChange={(event) => setCreateForm((current) => ({ ...current, contactName: event.target.value }))} className="h-10 bg-white" placeholder="Contact person" />
              <Input value={createForm.email} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} className="h-10 bg-white" placeholder="Email" />
              <Input value={createForm.phone} onChange={(event) => setCreateForm((current) => ({ ...current, phone: event.target.value }))} className="h-10 bg-white" placeholder="Phone" />
              <select value={createForm.categoryId} onChange={(event) => setCreateForm((current) => ({ ...current, categoryId: event.target.value }))} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <select value={createForm.tier} onChange={(event) => setCreateForm((current) => ({ ...current, tier: event.target.value as typeof createForm.tier }))} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                <option value="pending_first_event">Pending First Event</option>
                <option value="tier_1">Tier 1</option>
                <option value="tier_2">Tier 2</option>
              </select>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <textarea value={createForm.serviceInclusions} onChange={(event) => setCreateForm((current) => ({ ...current, serviceInclusions: event.target.value }))} className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Service inclusions" />
              <textarea value={createForm.performanceNotes} onChange={(event) => setCreateForm((current) => ({ ...current, performanceNotes: event.target.value }))} className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Private performance notes" />
            </div>
            <button type="button" disabled={busy || !createForm.name.trim()} onClick={submitCreate} className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-sm font-black text-sidebar-foreground disabled:opacity-60">
              <Check className="size-4" /> Save supplier
            </button>
          </div>
        )}

        <div className="mt-5 grid gap-2 lg:grid-cols-[minmax(220px,1fr)_180px_160px_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 bg-white pl-9"
              placeholder="Search supplier name, contact, email..."
            />
          </div>
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <select value={tier} onChange={(event) => setTier(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
            <option value="all">All tiers</option>
            <option value="tier_1">Tier 1</option>
            <option value="tier_2">Tier 2</option>
            <option value="pending_first_event">Pending First Event</option>
          </select>
          <select value={rating} onChange={(event) => setRating(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
            <option value="all">All ratings</option>
            <option value="4.5">4.5 and up</option>
            <option value="4.0">4.0 and up</option>
            <option value="unrated">Unrated</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <div className="grid min-w-[960px] grid-cols-[minmax(220px,1.2fr)_180px_160px_130px_160px_130px] bg-muted px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
            <span>Name</span>
            <span>Category</span>
            <span>Tier</span>
            <span>BNI</span>
            <span>Aggregate Rating</span>
            <span>Last Event</span>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {filtered.map((supplier) => (
              <button
                key={supplier.id}
                onClick={() => setSelectedSupplierId(supplier.id)}
                className={cx(
                  "grid min-w-[960px] w-full grid-cols-[minmax(220px,1.2fr)_180px_160px_130px_160px_130px] items-center gap-0 border-t border-border px-3 py-3 text-left text-sm hover:bg-secondary/70",
                  supplier.id === selectedSupplier?.id && "bg-secondary",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-black">{supplier.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{supplier.email || supplier.phone}</span>
                </span>
                <span className="text-muted-foreground">{supplier.categoryName}</span>
                <SupplierTierBadge tier={supplier.tier} />
                <span>
                  {supplier.bniMember ? (
                    <Badge variant="outline" className="rounded-full border-[#F06030]/30 bg-accent text-(--prism-amber)">BNI</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  )}
                </span>
                <RatingStars rating={supplier.aggregateRating} />
                <span className="text-muted-foreground">{supplier.lastEventDate ?? "None"}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground">
                No suppliers match the active filters.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-primary/12 bg-card p-5 shadow-none">
        {!selectedSupplier ? (
          <div className="grid min-h-[420px] place-items-center text-center text-sm text-muted-foreground">
            Select a supplier to open the full PMCM profile.
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-(--prism-amber)">Supplier Profile</p>
              <h3 className="mt-2 text-2xl font-black">{selectedSupplier.name}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <SupplierTierBadge tier={selectedSupplier.tier} />
                <Badge variant="outline" className="rounded-full bg-secondary">{selectedSupplier.categoryName}</Badge>
                {selectedSupplier.autoTrust && (
                  <Badge variant="outline" className="rounded-full border-[#F06030]/30 bg-accent text-(--prism-amber)">Auto-Trust</Badge>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-black">BNI Member</p>
                  <p className="mt-1 text-xs text-muted-foreground">Toggling this enables the system Auto-Trust flag.</p>
                </div>
                <button
                  disabled={busy}
                  onClick={() => onToggleBni(selectedSupplier, !selectedSupplier.bniMember)}
                  className={cx(
                    "h-9 rounded-full px-4 text-xs font-black",
                    selectedSupplier.bniMember ? "bg-(--prism-ink) text-sidebar-foreground" : "border border-border bg-white text-foreground",
                  )}
                >
                  {selectedSupplier.bniMember ? "BNI On" : "BNI Off"}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">Edit Profile</p>
              <div className="mt-3 grid gap-2">
                <Input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} className="h-10 bg-white" placeholder="Supplier name" />
                <Input value={editForm.contactName} onChange={(event) => setEditForm((current) => ({ ...current, contactName: event.target.value }))} className="h-10 bg-white" placeholder="Contact person" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={editForm.email} onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))} className="h-10 bg-white" placeholder="Email" />
                  <Input value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} className="h-10 bg-white" placeholder="Phone" />
                </div>
                <textarea value={editForm.serviceInclusions} onChange={(event) => setEditForm((current) => ({ ...current, serviceInclusions: event.target.value }))} className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Service inclusions" />
                <textarea value={editForm.performanceNotes} onChange={(event) => setEditForm((current) => ({ ...current, performanceNotes: event.target.value }))} className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Private PMCM performance notes" />
              </div>
              <button type="button" disabled={busy || !editForm.name.trim()} onClick={saveProfile} className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60">
                <Check className="size-4" /> Save profile
              </button>
            </div>

            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">Tier Change</p>
              <div className="mt-3 grid gap-2">
                <select value={tierForm.tier} onChange={(event) => setTierForm((current) => ({ ...current, tier: event.target.value as typeof tierForm.tier }))} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                  <option value="tier_1">Tier 1</option>
                  <option value="tier_2">Tier 2</option>
                  <option value="pending_first_event">Pending First Event</option>
                </select>
                <textarea value={tierForm.reason} onChange={(event) => setTierForm((current) => ({ ...current, reason: event.target.value }))} className="min-h-16 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Required reason for audit trail" />
              </div>
              <button type="button" disabled={busy || !tierForm.reason.trim()} onClick={submitTierChange} className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60">
                <Check className="size-4" /> Change tier
              </button>
            </div>

            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">Private PMCM Review</p>
              <div className="mt-3 grid gap-2">
                <select value={reviewForm.rating} onChange={(event) => setReviewForm((current) => ({ ...current, rating: event.target.value }))} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
                </select>
                <textarea value={reviewForm.notes} onChange={(event) => setReviewForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-20 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Private review notes" />
              </div>
              <button type="button" disabled={busy || !reviewForm.notes.trim()} onClick={submitReview} className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60">
                <Star className="size-4" /> Add review
              </button>
            </div>

            <div className="rounded-lg border border-border bg-muted p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-(--prism-amber)">Certification Metadata</p>
              <div className="mt-3 grid gap-2">
                <Input value={certForm.fileName} onChange={(event) => setCertForm((current) => ({ ...current, fileName: event.target.value }))} className="h-10 bg-white" placeholder="File name" />
                <Input value={certForm.documentType} onChange={(event) => setCertForm((current) => ({ ...current, documentType: event.target.value }))} className="h-10 bg-white" placeholder="Document type" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={certForm.issuer} onChange={(event) => setCertForm((current) => ({ ...current, issuer: event.target.value }))} className="h-10 bg-white" placeholder="Issuer" />
                  <Input type="date" value={certForm.expiresAt} onChange={(event) => setCertForm((current) => ({ ...current, expiresAt: event.target.value }))} className="h-10 bg-white" />
                </div>
                <select value={certForm.status} onChange={(event) => setCertForm((current) => ({ ...current, status: event.target.value as typeof certForm.status }))} className="h-10 rounded-md border border-border bg-white px-3 text-sm">
                  <option value="submitted">Submitted</option>
                  <option value="verified">Verified</option>
                  <option value="expired">Expired</option>
                  <option value="rejected">Rejected</option>
                </select>
                <textarea value={certForm.notes} onChange={(event) => setCertForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-16 rounded-md border border-border bg-white px-3 py-2 text-sm" placeholder="Metadata notes" />
              </div>
              <button type="button" disabled={busy || !certForm.fileName.trim() || !certForm.documentType.trim()} onClick={submitCertification} className="mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-(--prism-ink) px-3 text-xs font-black text-sidebar-foreground disabled:opacity-60">
                <FilePlus2 className="size-4" /> Add certification
              </button>
            </div>

            <div className="grid gap-3 text-sm">
              <div className="rounded-md bg-background p-3">
                <p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Contact</p>
                <p className="mt-1 font-semibold">{selectedSupplier.contactName || "No contact person"}</p>
                <p className="text-muted-foreground">{selectedSupplier.email || "No email"} - {selectedSupplier.phone || "No phone"}</p>
              </div>
              <div className="rounded-md bg-background p-3">
                <p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Internal Rating</p>
                <div className="mt-2"><RatingStars rating={selectedSupplier.aggregateRating} /></div>
              </div>
              <div className="rounded-md bg-background p-3">
                <p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Service Inclusions</p>
                <p className="mt-1 leading-6 text-muted-foreground">{selectedSupplier.serviceInclusions}</p>
              </div>
              <div className="rounded-md bg-background p-3">
                <p className="text-xs font-black uppercase tracking-wide text-(--prism-amber)">Performance Notes</p>
                <p className="mt-1 leading-6 text-muted-foreground">{selectedSupplier.performanceNotes}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Past Events</p>
              <div className="mt-2 space-y-2">
                {selectedSupplier.pastEvents.length === 0 && <p className="text-sm text-muted-foreground">No linked event records yet.</p>}
                {selectedSupplier.pastEvents.map((event) => (
                  <button key={event.id} onClick={() => onOpenEvent(event.id)} className="w-full rounded-md border border-border bg-white p-3 text-left text-sm hover:border-primary/40">
                    <span className="block font-black">{event.eventName}</span>
                    <span className="text-muted-foreground">{event.clientName} - {event.eventDate}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reliability Notes</p>
              <div className="mt-2 space-y-2">
                {selectedSupplier.reliabilityNotes.map((note) => (
                  <div key={note.id} className="rounded-md bg-background p-3 text-sm">
                    <p>{note.note}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{note.eventName ?? "Directory note"} - {note.createdAt.slice(0, 10)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Certifications Uploaded</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedSupplier.certifications.map((certification) => (
                  <span key={certification.id} className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold">
                    {certification.fileName}
                    {certification.documentType ? ` - ${certification.documentType}` : ""}
                    {certification.status ? ` (${certification.status})` : ""}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Application date: {selectedSupplier.applicationDate}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
