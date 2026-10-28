"use client";

import { useCallback, useEffect, useState } from "react";
import type { FileRequirementTemplateItemInput, FileRequirementRole, PrismFileRequirementTemplate } from "@prism/types";
import { applyFileRequirementTemplate, loadFileRequirementTemplates, saveFileRequirementTemplate } from "../use-cases/file-requirement-template-actions";

const emptyItem = (): FileRequirementTemplateItemInput => ({ key: "", label: "", ownerRole: "client", visibleToRoles: ["pmcm-admin", "client"], required: true });

export function useFileRequirementTemplateManagerViewModel(eventId: string, onApplied: () => void) {
  const [templates, setTemplates] = useState<PrismFileRequirementTemplate[]>([]);
  const [eventType, setEventType] = useState("");
  const [requirements, setRequirements] = useState<FileRequirementTemplateItemInput[]>([emptyItem()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadFileRequirementTemplates().then((rows) => { if (active) setTemplates(rows); })
      .catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "Unable to load templates."); });
    return () => { active = false; };
  }, []);

  const chooseEventType = useCallback((value: string) => {
    setEventType(value);
    const match = templates.find((template) => template.eventType === value.trim().toLocaleLowerCase("en-US"));
    setRequirements(match?.requirements.length ? match.requirements : [emptyItem()]);
  }, [templates]);

  const changeRequirement = useCallback((index: number, patch: Partial<FileRequirementTemplateItemInput>) => {
    setRequirements((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, ...patch };
      const visible = new Set<FileRequirementRole>([...next.visibleToRoles, "pmcm-admin", next.ownerRole]);
      return { ...next, visibleToRoles: [...visible] };
    }));
  }, []);

  const addRequirement = useCallback(() => setRequirements((current) => [...current, emptyItem()]), []);
  const removeRequirement = useCallback((index: number) => setRequirements((current) => current.filter((_, itemIndex) => itemIndex !== index)), []);

  const save = useCallback(async () => {
    setBusy(true); setMessage(null);
    try {
      const saved = await saveFileRequirementTemplate({ eventType, requirements });
      setTemplates((current) => [...current.filter((item) => item.eventType !== saved.eventType), saved].sort((a, b) => a.eventType.localeCompare(b.eventType)));
      setEventType(saved.eventType); setRequirements(saved.requirements);
      setMessage(`Saved ${saved.requirements.length} requirements for ${saved.eventType}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save template."); }
    finally { setBusy(false); }
  }, [eventType, requirements]);

  const apply = useCallback(async () => {
    setBusy(true); setMessage(null);
    try {
      const result = await applyFileRequirementTemplate(eventId);
      setMessage(`Applied ${result.createdKeys.length} requirement${result.createdKeys.length === 1 ? "" : "s"}; ${result.skippedExistingCount} already existed.`);
      onApplied();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to apply the event template."); }
    finally { setBusy(false); }
  }, [eventId, onApplied]);

  return { templates, eventType, requirements, busy, message, setEventType: chooseEventType, changeRequirement, addRequirement, removeRequirement, save, apply };
}
