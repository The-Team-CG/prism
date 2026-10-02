"use client";

import { useEffect, useState } from "react";
import { coordinatorWalkInCheckInSchema, type PrismCoordinatorRegistrationEntry, type UpdateGuestVerificationInput } from "@prism/types";
import { coordinatorRegistrationRepository } from "../data/coordinator-registration-repository";

type DeskStatus = "idle" | "loading" | "ready";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function useCoordinatorRegistrationDeskViewModel(eventId: string) {
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<PrismCoordinatorRegistrationEntry[]>([]);
  const [status, setStatus] = useState<DeskStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [walkInName, setWalkInName] = useState("");
  const [privacyConsentAccepted, setPrivacyConsentAccepted] = useState(false);
  const [walkInBusy, setWalkInBusy] = useState(false);

  useEffect(() => {
    setQuery("");
    setEntries([]);
    setStatus("idle");
    setError(null);
    setNotice(null);
    setBusyEntryId(null);
    setWalkInName("");
    setPrivacyConsentAccepted(false);
  }, [eventId]);

  async function loadRoster(searchTerm: string) {
    const rows = await coordinatorRegistrationRepository.search(eventId, searchTerm);
    setEntries(rows);
    setStatus("ready");
  }

  async function search() {
    const searchTerm = query.trim();
    if (searchTerm.length < 2) {
      setError("Enter at least two letters to search the guest roster.");
      return;
    }
    setStatus("loading");
    setError(null);
    setNotice(null);
    try {
      await loadRoster(searchTerm);
    } catch (searchError) {
      setStatus("idle");
      setError(errorMessage(searchError, "Unable to search the guest roster."));
    }
  }

  async function refreshRoster() {
    const searchTerm = query.trim();
    if (searchTerm.length < 2) return;
    const rows = await coordinatorRegistrationRepository.search(eventId, searchTerm);
    setEntries(rows);
    setStatus("ready");
  }

  async function checkIn(entry: PrismCoordinatorRegistrationEntry) {
    setBusyEntryId(entry.id);
    setError(null);
    setNotice(null);
    try {
      await coordinatorRegistrationRepository.checkIn(eventId, entry.id);
      await refreshRoster();
      setNotice(`${entry.guestName} checked in.`);
    } catch (checkInError) {
      setError(errorMessage(checkInError, "Unable to check in this guest."));
    } finally {
      setBusyEntryId(null);
    }
  }

  async function updateVerification(entry: PrismCoordinatorRegistrationEntry, status: UpdateGuestVerificationInput["status"]) {
    setBusyEntryId(entry.id);
    setError(null);
    setNotice(null);
    try {
      await coordinatorRegistrationRepository.verify(eventId, entry.id, status);
      await refreshRoster();
      setNotice(`${entry.guestName} marked ${status}.`);
    } catch (verificationError) {
      setError(errorMessage(verificationError, "Unable to update guest verification."));
    } finally {
      setBusyEntryId(null);
    }
  }

  async function registerWalkIn() {
    const parsed = coordinatorWalkInCheckInSchema.safeParse({
      guestName: walkInName,
      privacyConsentAccepted,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter the guest name and confirm privacy consent.");
      return;
    }
    setWalkInBusy(true);
    setError(null);
    setNotice(null);
    try {
      const entry = await coordinatorRegistrationRepository.registerWalkIn(eventId, parsed.data);
      setEntries((current) => [entry, ...current.filter((candidate) => candidate.id !== entry.id)]);
      setStatus("ready");
      setQuery(entry.guestName);
      setWalkInName("");
      setPrivacyConsentAccepted(false);
      setNotice(`${entry.guestName} was added to the roster pending verification.`);
    } catch (walkInError) {
      setError(errorMessage(walkInError, "Unable to register this walk-in. Check the event's walk-in policy."));
    } finally {
      setWalkInBusy(false);
    }
  }

  return {
    query,
    setQuery,
    entries,
    status,
    error,
    notice,
    busyEntryId,
    search,
    checkIn,
    updateVerification,
    walkInName,
    setWalkInName,
    privacyConsentAccepted,
    setPrivacyConsentAccepted,
    walkInBusy,
    registerWalkIn,
  };
}
