"use client";

import { useCallback, useEffect, useState } from "react";
import {
  completeExternalCreativeTicketSchema,
  createExternalCreativeTicketSchema,
  parseContract,
  updateExternalCreativeTicketSchema,
  type PrismExternalCreativeTicket,
} from "@prism/types";
import { externalCreativeRepository } from "../data/external-creative-repository";

export function useExternalCreative(eventId: string) {
  const [tickets, setTickets] = useState<PrismExternalCreativeTicket[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTickets(await externalCreativeRepository.list(eventId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load creative tickets.");
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not ${label}.`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return {
    tickets,
    busy,
    error,
    create: (form: { designerName: string; designerContact: string; deliverable: string; dueDate: string }) =>
      run("open the ticket", () => externalCreativeRepository.create(eventId, parseContract(createExternalCreativeTicketSchema, { ...form, dueDate: form.dueDate || undefined }, "Creative ticket"))),
    update: (ticketId: string, status: "in_progress" | "delivered", progressNote: string) =>
      run("update the ticket", () => externalCreativeRepository.update(eventId, ticketId, parseContract(updateExternalCreativeTicketSchema, { status, progressNote }, "Creative ticket update"))),
    complete: (ticketId: string, outputDocumentId: string) =>
      run("complete the ticket", () => externalCreativeRepository.complete(eventId, ticketId, parseContract(completeExternalCreativeTicketSchema, { outputDocumentId }, "Creative ticket completion"))),
  };
}
