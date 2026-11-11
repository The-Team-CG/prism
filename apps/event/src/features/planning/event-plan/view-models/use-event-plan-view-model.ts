"use client";

import { useCallback, useMemo, useState } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import type { PrismEventPlanItem, PrismPlanPreview } from "@prism/types";
import { toast } from "@prism/ui/components/sonner";
import { planningTemplates } from "../../templates/data/templates-repository";
import { eventPlan, planRepository } from "../data/event-plan-repository";
import { groupByTemplate, planProgress, toggledStatus } from "../model/plan-rules";
import { submitApply, submitPreview, submitStatus, submitTaskEdit, type TaskDraft } from "../use-cases/plan-commands";

export type PlanDialog = { kind: "apply" } | { kind: "edit"; itemId: string };

export type EventPlanViewModel = ReturnType<typeof useEventPlanViewModel>;

/** One event's plan: its tasks, the apply dialog with its preview, and the edit dialog for a single task. */
export function useEventPlanViewModel(eventId: string) {
  const plan = useResource(eventPlan, eventId);
  const templates = useResource(planningTemplates, "all");
  const invalidate = useInvalidate();
  const [dialog, setDialog] = useState<PlanDialog | null>(null);
  const [preview, setPreview] = useState<PrismPlanPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(() => plan.data ?? [], [plan.data]);
  const applicable = useMemo(() => (templates.data ?? []).filter((template) => !template.archived), [templates.data]);

  const closeDialog = useCallback(() => { setDialog(null); setPreview(null); setError(null); }, []);
  const openApply = useCallback(() => { setPreview(null); setError(null); setDialog({ kind: "apply" }); }, []);
  const openEdit = useCallback((itemId: string) => { setError(null); setDialog({ kind: "edit", itemId }); }, []);

  const run = useCallback(async (action: () => Promise<unknown>, message: string, closes: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (closes) closeDialog();
      await invalidate(eventPlan);
      toast.success(message);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [closeDialog, invalidate]);

  const showPreview = useCallback(async (templateId: string, version?: number) => {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      setPreview(await submitPreview(planRepository, eventId, templateId, version));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview. Try again.");
    } finally {
      setBusy(false);
    }
  }, [eventId]);

  return {
    status: plan.status,
    loadError: plan.status === "error" ? plan.error.message : null,
    items,
    groups: groupByTemplate(items),
    progress: planProgress(items),
    applicable,
    dialog,
    editing: dialog?.kind === "edit" ? items.find((item) => item.id === dialog.itemId) ?? null : null,
    preview,
    busy,
    error,
    openApply,
    openEdit,
    closeDialog,
    showPreview,
    clearPreview: () => setPreview(null),
    apply: () => (preview ? run(() => submitApply(planRepository, eventId, preview), "Template applied to the plan", true) : Promise.resolve(false)),
    toggle: (item: PrismEventPlanItem) => run(() => submitStatus(planRepository, eventId, item, toggledStatus(item)), "Task updated", false),
    saveTask: (item: PrismEventPlanItem, draft: TaskDraft) => run(() => submitTaskEdit(planRepository, eventId, item, draft), "Task saved", true),
  };
}
