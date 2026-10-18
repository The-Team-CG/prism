import { useCallback, useEffect, useMemo, useState } from "react";
import type { PrismHandoffBrief } from "@prism/types";
import { loadHandoffBrief } from "../use-cases/load-handoff-brief";
import { summarizeHandoffBrief } from "../model/handoff-brief-summary";

export function useHandoffBriefViewModel(eventId: string) {
  const [brief, setBrief] = useState<PrismHandoffBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setError(null);
      setBrief(await loadHandoffBrief(eventId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    setBrief(null);
    void reload();
  }, [reload]);

  const summary = useMemo(() => (brief ? summarizeHandoffBrief(brief) : null), [brief]);
  return { brief, summary, error, loading, reload };
}
