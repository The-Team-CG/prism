"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checkInButtonLabel,
  formatFileSize,
  isFileWithinSizeLimit,
  isVideoDurationAllowed,
  mapGuestDashboardError,
  MAX_VIDEO_DURATION_S,
  POLL_INTERVAL_MS,
} from "../model/guest-dashboard-rules";
import type {
  CheckInMode,
  GuestBusyAction,
  GuestDashboardStatus,
  GuestSession,
} from "../model/guest-dashboard-types";
import {
  leaveGuestEvent,
  loadGuestDashboardSession,
  refreshGuestEvent,
  submitGuestCheckIn,
  submitGuestFeedback,
} from "../use-cases/guest-dashboard-actions";

function checkVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => reject(new Error("Unable to read video."));
    video.src = URL.createObjectURL(file);
  });
}

export function useGuestDashboardViewModel() {
  const router = useRouter();
  const [session, setSession] = useState<GuestSession | null>(null);
  const [status, setStatus] = useState<GuestDashboardStatus>("loading");
  const [checkedIn, setCheckedIn] = useState(false);
  const [walkIn, setWalkIn] = useState(false);
  const [checkInConsentAccepted, setCheckInConsentAccepted] = useState(false);
  const [checkInMode, setCheckInMode] = useState<CheckInMode>("name_search");
  const [feedbackRating, setFeedbackRating] = useState("5");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackConsentAccepted, setFeedbackConsentAccepted] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<GuestBusyAction>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoDurationError, setVideoDurationError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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
      const next = await refreshGuestEvent(current);
      setSession(next);
    } catch {
      // Silently ignore poll errors — stale data is acceptable
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
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
        walkIn,
        consentAccepted: checkInConsentAccepted,
      });
      setSession(result.session);
      setCheckedIn(true);
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

    if (videoFile) {
      try {
        const duration = await checkVideoDuration(videoFile);
        if (!isVideoDurationAllowed(duration)) {
          setVideoDurationError(
            `Video must be ${MAX_VIDEO_DURATION_S} seconds or shorter.`,
          );
          setBusy(null);
          return;
        }
      } catch {
        // If we can't check duration, allow submission
      }
    }

    try {
      await submitGuestFeedback({
        session,
        rating: feedbackRating,
        comment: feedbackComment,
        consentAccepted: feedbackConsentAccepted,
        photo: photoFile,
        video: videoFile,
      });
      setFeedbackSubmitted(true);
      setNotice("Feedback submitted for moderation.");
      setFeedbackComment("");
      setPhotoFile(null);
      setVideoFile(null);
      setVideoDurationError(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (videoInputRef.current) videoInputRef.current.value = "";
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(mapGuestDashboardError(err));
    } finally {
      setBusy(null);
    }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isFileWithinSizeLimit(file.size)) {
      setError("Photo must be 10 MB or smaller.");
      return;
    }
    setPhotoFile(file);
    setError(null);
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isFileWithinSizeLimit(file.size)) {
      setError("Video must be 10 MB or smaller.");
      return;
    }
    setVideoFile(file);
    setVideoDurationError(null);
    setError(null);
  }

  function leave() {
    leaveGuestEvent();
    router.replace("/open");
  }

  return {
    session,
    status,
    checkedIn,
    walkIn,
    setWalkIn,
    checkInConsentAccepted,
    setCheckInConsentAccepted,
    checkInMode,
    setCheckInMode: (mode: CheckInMode) => {
      setCheckInMode(mode);
      setWalkIn(false);
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
    photoFile,
    videoFile,
    videoDurationError,
    photoInputRef,
    videoInputRef,
    checkInButtonLabel: checkInButtonLabel({ checkedIn, checkInMode, walkIn }),
    formatFileSize,
    checkIn,
    submitFeedback,
    handlePhotoSelect,
    handleVideoSelect,
    clearPhoto: () => {
      setPhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = "";
    },
    clearVideo: () => {
      setVideoFile(null);
      setVideoDurationError(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
    },
    leave,
  };
}
