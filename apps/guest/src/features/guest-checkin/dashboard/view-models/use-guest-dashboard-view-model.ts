"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkInButtonLabel,
  isGuestAccessEndedError,
  mapGuestDashboardError,
  POLL_INTERVAL_MS,
} from "../model/guest-dashboard-rules";
import type { CheckInMode, GuestBusyAction, GuestDashboardStatus, GuestSession } from "../model/guest-dashboard-types";
import {
  leaveGuestEvent,
  loadGuestDashboardSession,
  refreshGuestEventIfChanged,
  submitGuestCheckIn,
  submitGuestFeedback,
  withdrawGuestFeedbackConsent,
  saveGuestFeedbackReceipt,
} from "../use-cases/guest-dashboard-actions";

export function useGuestDashboardViewModel() {
  const router = useRouter();
  const [session, setSession] = useState<GuestSession | null>(null);
  const [status, setStatus] = useState<GuestDashboardStatus>("loading");
  const [checkedIn, setCheckedIn] = useState(false);
  const [accessEnded, setAccessEnded] = useState(false);
  const [checkInGuestName, setCheckInGuestName] = useState("");
  const [checkInConsentAccepted, setCheckInConsentAccepted] = useState(false);
  const [checkInMode, setCheckInMode] = useState<CheckInMode>("name_search");
  const [feedbackGuestName, setFeedbackGuestName] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackConsentAccepted, setFeedbackConsentAccepted] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<GuestBusyAction>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);

  useEffect(() => {
    const current = loadGuestDashboardSession();
    if (!current) {
      router.replace("/open?next=/dashboard");
      return;
    }
    setSession(current);
    setStatus("ready");
  }, [router]);

  const refreshEvent = useCallback(async (current = session) => {
    if (!current) return;
    try {
      const next = await refreshGuestEventIfChanged(current);
      setSession(next);
      setAccessEnded(false);
      setRefreshFailed(false);
    } catch (err) {
      if (isGuestAccessEndedError(err)) {
        if (current.feedbackReceiptId) {
          setAccessEnded(true);
          if (current.feedbackAvailability !== "closed") setSession({ ...current, feedbackAvailability: "closed" });
          setNotice("Event access has ended. You can still withdraw consent for your saved feedback.");
          return;
        }
        leaveGuestEvent();
        router.replace("/open");
        return;
      }
      setRefreshFailed(true);
    }
  }, [session, router]);

  useEffect(() => {
    if (!session) return;
    void refreshEvent();
    const id = setInterval(() => {
      void refreshEvent();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [session, refreshEvent]);

  async function checkIn() {
    if (!session || busy) return;
    setBusy("check-in");
    setError(null);
    setNotice(null);
    try {
      const result = await submitGuestCheckIn({
        session,
        checkInMode,
        guestName: checkInMode === "name_search" ? checkInGuestName : undefined,
        consentAccepted: checkInConsentAccepted,
      });
      setSession(result.session);
      setCheckedIn(true);
      setCheckInGuestName("");
      setNotice(result.notice);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(mapGuestDashboardError(err));
    } finally {
      setBusy(null);
    }
  }

  async function submitFeedback(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!session || busy) return;
    setBusy("feedback");
    setError(null);
    setNotice(null);

    try {
      const receipt = await submitGuestFeedback({
        session,
        guestName: feedbackGuestName,
        rating: feedbackRating,
        comment: feedbackComment,
        consentAccepted: feedbackConsentAccepted,
      });
      setSession(saveGuestFeedbackReceipt(session, receipt));
      setFeedbackSubmitted(true);
      setNotice("Feedback sent to PMCM for review. It will not be published automatically.");
      setFeedbackGuestName("");
      setFeedbackComment("");
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(mapGuestDashboardError(err));
    } finally {
      setBusy(null);
    }
  }

  async function withdrawFeedbackConsent() {
    if (!session || busy) return;
    setBusy("feedback");
    setError(null);
    try {
      setSession(await withdrawGuestFeedbackConsent(session));
      setFeedbackSubmitted(false);
      setFeedbackConsentAccepted(false);
      setNotice("Feedback consent withdrawn. Your feedback will no longer be shared.");
    } catch (cause) {
      setError(mapGuestDashboardError(cause));
    } finally { setBusy(null); }
  }

  function leave() {
    leaveGuestEvent();
    router.replace("/open");
  }

  return {
    session,
    status,
    checkedIn,
    checkInGuestName,
    setCheckInGuestName,
    checkInConsentAccepted,
    setCheckInConsentAccepted,
    checkInMode,
    setCheckInMode: (mode: CheckInMode) => {
      setCheckInMode(mode);
      setCheckInGuestName("");
    },
    feedbackGuestName,
    setFeedbackGuestName: (guestName: string) => {
      setFeedbackGuestName(guestName);
      setFeedbackSubmitted(false);
    },
    feedbackRating,
    setFeedbackRating: (rating: string) => {
      setFeedbackRating(rating);
      setFeedbackSubmitted(false);
    },
    feedbackComment,
    setFeedbackComment: (comment: string) => {
      setFeedbackComment(comment);
      setFeedbackSubmitted(false);
    },
    feedbackConsentAccepted,
    setFeedbackConsentAccepted,
    feedbackSubmitted,
    canWithdrawFeedbackConsent: Boolean(session?.feedbackReceiptId),
    withdrawFeedbackConsent,
    error,
    notice,
    busy,
    refreshFailed,
    canCheckIn: !accessEnded && !checkedIn
      && !busy
      && checkInConsentAccepted
      && (checkInMode === "headcount" || checkInGuestName.trim().length > 0),
    canSubmitFeedback: !accessEnded && session?.feedbackAvailability === "open"
      && !busy
      && feedbackConsentAccepted
      && feedbackGuestName.trim().length > 0,
    checkInButtonLabel: checkInButtonLabel(checkedIn),
    checkIn,
    submitFeedback,
    leave,
  };
}
