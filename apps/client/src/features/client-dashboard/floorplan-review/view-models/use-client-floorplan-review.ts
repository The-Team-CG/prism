"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClientFloorPlanAnnotationSchema, decideClientFloorPlanSchema, parseContract, type PrismClientFloorPlanReview } from "@prism/types";
import { clientFloorplanReviewRepository } from "../data/client-floorplan-review-repository";

/** `onDecided` runs after a decision is saved so the workspace can show the draft's new state (a revision request returns it to PMCM). */
export function useClientFloorplanReview(eventId: string, draftId: string, onDecided?: () => Promise<void>) {
  const [review, setReview] = useState<PrismClientFloorPlanReview | null>(null);
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [objectId, setObjectId] = useState("");
  const [annotation, setAnnotation] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentKey = useRef(`${eventId}:${draftId}`);
  currentKey.current = `${eventId}:${draftId}`;
  const load = useCallback(async () => {
    const key = `${eventId}:${draftId}`;
    if (currentKey.current === key) { setLoading(true); setError(null); }
    try {
      const result = await clientFloorplanReviewRepository.get(eventId, draftId);
      if (currentKey.current === key) { setReview(result); setReviewKey(key); setError(null); }
    } catch (cause) {
      if (currentKey.current === key) {
        setReview(null);
        setReviewKey(null);
        setError(cause instanceof Error ? cause.message : "Could not load the official floorplan review.");
      }
    } finally { if (currentKey.current === key) setLoading(false); }
  }, [eventId, draftId]);
  useEffect(() => {
    setReview(null);
    setReviewKey(null);
    setComment("");
    setObjectId("");
    setAnnotation("");
    setBusy(false);
    setError(null);
    setLoading(true);
    void load();
  }, [load]);
  const visibleReview = reviewKey === currentKey.current ? review : null;
  const decide = async (action: "approve" | "request_revision") => {
    if (!visibleReview) return;
    const requestedKey = `${eventId}:${draftId}`;
    setBusy(true); setError(null);
    try {
      const input = parseContract(decideClientFloorPlanSchema, { snapshotHash: visibleReview.snapshotHash, action, comment, idempotencyKey: crypto.randomUUID() }, "Floorplan decision");
      await clientFloorplanReviewRepository.decide(eventId, draftId, input);
      setComment("");
      if (action === "request_revision") await onDecided?.();
      else { await load(); await onDecided?.(); }
    } catch (cause) { if (currentKey.current === requestedKey) setError(cause instanceof Error ? cause.message : "Could not save the floorplan decision."); }
    finally { if (currentKey.current === requestedKey) setBusy(false); }
  };
  const annotate = async () => {
    if (!visibleReview || !annotation.trim()) return;
    const requestedKey = `${eventId}:${draftId}`;
    setBusy(true); setError(null);
    try {
      const input = parseContract(createClientFloorPlanAnnotationSchema, { snapshotHash: visibleReview.snapshotHash, objectId, comment: annotation }, "Floorplan annotation");
      await clientFloorplanReviewRepository.annotate(eventId, draftId, input);
      setAnnotation(""); await load();
    } catch (cause) { if (currentKey.current === requestedKey) setError(cause instanceof Error ? cause.message : "Could not add the annotation."); }
    finally { if (currentKey.current === requestedKey) setBusy(false); }
  };
  const objects = (visibleReview?.snapshot as { objects?: Array<{ id?: string; kind?: string; name?: string }> } | undefined)?.objects ?? [];
  return { review: visibleReview, loading, comment, setComment, objectId, setObjectId, annotation, setAnnotation, busy, error, load, decide, annotate, objects, decision: visibleReview?.decisions.at(-1) };
}
