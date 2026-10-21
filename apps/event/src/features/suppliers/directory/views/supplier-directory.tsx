import { useEffect, useState } from "react";

import type { CreateSupplierReviewInput, PrismSupplier, PrismSupplierCategory } from "@prism/types";
import { isSupplierCreateDraftValid, supplierMatchesDirectoryFilters } from "../model/suppliers-directory-rules";
import { SupplierDirectoryList, SupplierProfile } from "./supplier-directory-sections";

export function SupplierDirectory({
  categories,
  suppliers,
  onToggleBni,
  onCreateSupplier,
  onUpdateSupplier,
  onChangeTier,
  eventId,
  onPromote,
  onAddReview,
  onAddCertification,
  onOpenEvent,
  busy,
}: {
  categories: PrismSupplierCategory[];
  suppliers: PrismSupplier[];
  onToggleBni: (supplier: PrismSupplier, nextValue: boolean) => Promise<void>;
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
  eventId?: string;
  onPromote: (supplierId: string, tier: "tier_1" | "tier_2", reason: string) => Promise<void>;
  onAddReview: (supplierId: string, input: CreateSupplierReviewInput) => Promise<boolean>;
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
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
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
  const [reviewDimensionRatings, setReviewDimensionRatings] = useState<Record<string, string>>({});
  const [reviewIdempotencyKey, setReviewIdempotencyKey] = useState(() => crypto.randomUUID());
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
    setSelectedSupplierId(null);
  }, [selectedSupplierId, suppliers]);

  const filtered = suppliers.filter((supplier) =>
    supplierMatchesDirectoryFilters(supplier, { query, categoryId, tier, rating }),
  );
  const selectedSupplier = suppliers.find((supplier) => supplier.id === selectedSupplierId);

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
    setReviewDimensionRatings({});
    setReviewIdempotencyKey(crypto.randomUUID());
    setCertForm({ fileName: "", documentType: "", issuer: "", expiresAt: "", status: "submitted", notes: "" });
  }, [selectedSupplier?.id]);

  async function submitCreate() {
    if (!isSupplierCreateDraftValid(createForm) || !createForm.categoryId) return;
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
    if (selectedSupplier.tier === "pending_first_event" && tierForm.tier !== "pending_first_event" && eventId) await onPromote(selectedSupplier.id, tierForm.tier, tierForm.reason);
    else await onChangeTier(selectedSupplier.id, tierForm.tier, tierForm.reason);
    setTierForm((current) => ({ ...current, reason: "" }));
  }

  async function submitReview() {
    if (!selectedSupplier || !reviewForm.notes.trim()) return;
    const dimensionRatings = Object.entries(reviewDimensionRatings)
      .filter(([, value]) => value)
      .map(([dimensionId, value]) => ({ dimensionId, rating: Number(value) }));
    const succeeded = await onAddReview(selectedSupplier.id, {
      rating: Number(reviewForm.rating),
      notes: reviewForm.notes,
      dimensionRatings: dimensionRatings.length ? dimensionRatings : undefined,
      idempotencyKey: reviewIdempotencyKey,
    });
    if (!succeeded) return;
    setReviewForm({ rating: "4", notes: "" });
    setReviewDimensionRatings({});
    setReviewIdempotencyKey(crypto.randomUUID());
  }

  async function submitCertification() {
    if (!selectedSupplier || !certForm.fileName.trim() || !certForm.documentType.trim()) return;
    await onAddCertification(selectedSupplier.id, certForm);
    setCertForm({ fileName: "", documentType: "", issuer: "", expiresAt: "", status: "submitted", notes: "" });
  }

  if (!selectedSupplier) {
    return (
      <div className="grid gap-5">
        <SupplierDirectoryList
          suppliers={suppliers}
          filtered={filtered}
          categories={categories}
          query={query}
          categoryId={categoryId}
          tier={tier}
          rating={rating}
          selectedSupplierId={selectedSupplierId}
          showCreate={showCreate}
          createForm={createForm}
          busy={busy}
          onQuery={setQuery}
          onCategoryId={setCategoryId}
          onTier={setTier}
          onRating={setRating}
          onSelect={setSelectedSupplierId}
          onToggleCreate={() => setShowCreate((current) => !current)}
          onCreateForm={(patch) => setCreateForm((current) => ({ ...current, ...patch }))}
          onSubmitCreate={submitCreate}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <SupplierProfile
        supplier={selectedSupplier}
        categories={categories}
        editForm={editForm}
        tierForm={tierForm}
        reviewForm={reviewForm}
        reviewDimensionRatings={reviewDimensionRatings}
        certForm={certForm}
        busy={busy}
        onBack={() => setSelectedSupplierId(null)}
        onToggleBni={() => onToggleBni(selectedSupplier, !selectedSupplier.bniMember)}
        onEditForm={(patch) => setEditForm((current) => ({ ...current, ...patch }))}
        onSaveProfile={saveProfile}
        onTierForm={(patch) => setTierForm((current) => ({ ...current, ...patch }))}
        onSubmitTier={submitTierChange}
        onReviewForm={(patch) => setReviewForm((current) => ({ ...current, ...patch }))}
        onReviewDimension={(dimensionId, value) => setReviewDimensionRatings((current) => ({ ...current, [dimensionId]: value }))}
        onSubmitReview={submitReview}
        onCertForm={(patch) => setCertForm((current) => ({ ...current, ...patch }))}
        onSubmitCertification={submitCertification}
        onOpenEvent={onOpenEvent}
      />
    </div>
  );
}
