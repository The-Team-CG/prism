"use client";

import { useCallback, useEffect, useState } from "react";
import { parseContract, upsertCoordinatorRoleBriefSchema, type CoordinatorRole, type PrismCoordinatorRoleBrief } from "@prism/types";
import { roleBriefsRepository } from "../data/role-briefs-repository";
import { callTimeToIso } from "../model/role-brief-rules";

export type RoleBriefForm = { callTime: string; attire: string; script: string; instructions: string };

export function useRoleBriefs(eventId: string) {
  const [briefs, setBriefs] = useState<PrismCoordinatorRoleBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBriefs(await roleBriefsRepository.list(eventId));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load role briefs.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  async function save(role: CoordinatorRole, form: RoleBriefForm) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const input = parseContract(upsertCoordinatorRoleBriefSchema, { ...form, callTime: callTimeToIso(form.callTime) }, "Role brief");
      await roleBriefsRepository.save(eventId, role, input);
      setNotice(`Saved the ${role} brief.`);
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the role brief.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { briefs, loading, saving, error, notice, save };
}
