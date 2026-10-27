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
} from "../use-cases/guest-dashboard-actions";

export function useGuestDashboardViewModel() {
  const router = useRouter();
  const [session, setSession] = useState<GuestSession | null>(null);
  const [status, setStatus] = useState<GuestDashboardStatus>("loading");
  const [checkedIn, setCheckedIn] = useState(false);
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
    } catch (err) {
      if (isGuestAccessEndedError(err)) {
        leaveGuestEvent();
        router.replace("/open");
      }
      // Other poll errors are ignored; stale event data is acceptable until the next poll.
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
      await submitGuestFeedback({
        session,
        guestName: feedbackGuestName,
        rating: feedbackRating,
        comment: feedbackComment,
        consentAccepted: feedbackConsentAccepted,
      });
      setFeedbackSubmitted(true);
      setNotice("Feedback submitted for moderation.");
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
    error,
    notice,
    busy,
    canCheckIn: !checkedIn
      && !busy
      && checkInConsentAccepted
      && (checkInMode === "headcount" || checkInGuestName.trim().length > 0),
    canSubmitFeedback: session?.feedbackAvailability === "open"
      && !busy
      && feedbackConsentAccepted
      && feedbackGuestName.trim().length > 0,
    checkInButtonLabel: checkInButtonLabel(checkedIn),
    checkIn,
    submitFeedback,
    leave,
  };
}
