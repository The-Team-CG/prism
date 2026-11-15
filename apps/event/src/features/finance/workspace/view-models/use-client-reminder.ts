"use client";

import { useState } from "react";
import { toast } from "@prism/ui/components/sonner";
import { remindClientPayment } from "../data/finance-repository";

/** "Remind client" on a payment: one reminder a day, and PMCM is told when one already went out today. */
export function useClientReminder(eventId: string) {
  const [busyId, setBusyId] = useState<string | null>(null);
  async function remind(milestoneId: string, label: string) {
    setBusyId(milestoneId);
    try {
      const result = await remindClientPayment(eventId, milestoneId);
      if (result.alreadySentToday) toast.info(`The client was already reminded about ${label} today.`);
      else toast.success(`Reminder about ${label} sent to the client.`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not send the reminder.");
    } finally {
      setBusyId(null);
    }
  }
  return { remind, busyId };
}
