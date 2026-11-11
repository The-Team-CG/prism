"use client";

import { useCallback, useState } from "react";
import { useInvalidate, useResource } from "@prism/portal-query";
import type { PrismPlanningTemplate } from "@prism/types";
import { toast } from "@prism/ui/components/sonner";
import { planningTemplate, planningTemplates, templatesRepository } from "../data/templates-repository";
import { submitArchive, submitNewTemplate, submitNewVersion } from "../use-cases/template-commands";
import type { TemplateDraft } from "../model/template-draft";

export type TemplateDialog = { kind: "new" } | { kind: "edit"; templateId: string };

export type PlanningTemplatesViewModel = ReturnType<typeof usePlanningTemplatesViewModel>;

/** The template catalogue: the list, and the one dialog that creates a template or publishes its next version. */
export function usePlanningTemplatesViewModel() {
  const list = useResource(planningTemplates, "all");
  const invalidate = useInvalidate();
  const [dialog, setDialog] = useState<TemplateDialog | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDialog = useCallback((next: TemplateDialog) => { setError(null); setDialog(next); }, []);
  const closeDialog = useCallback(() => { setError(null); setDialog(null); }, []);

  const run = useCallback(async (message: string, action: () => Promise<PrismPlanningTemplate>, closes: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (closes) setDialog(null);
      await Promise.all([invalidate(planningTemplates), invalidate(planningTemplate)]);
      toast.success(message);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [invalidate]);

  return {
    status: list.status,
    loadError: list.status === "error" ? list.error.message : null,
    templates: list.data ?? [],
    dialog,
    openNew: () => openDialog({ kind: "new" }),
    openEdit: (templateId: string) => openDialog({ kind: "edit", templateId }),
    closeDialog,
    busy,
    error,
    create: (draft: TemplateDraft) => run("Template created", () => submitNewTemplate(templatesRepository, draft), true),
    publish: (templateId: string, draft: TemplateDraft) => run("New version published", () => submitNewVersion(templatesRepository, templateId, draft), true),
    setArchived: (templateId: string, archive: boolean) =>
      run(archive ? "Template archived" : "Template restored", () => submitArchive(templatesRepository, templateId, archive), false),
  };
}
