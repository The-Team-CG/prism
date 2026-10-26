"use client";

import { useCallback, useEffect, useState } from "react";
import type { PrismInquiry, PrismUserRole } from "@prism/types";
import { readStoredEventSession } from "@/app/lib/session";
import { invitationOutcomeCopy, type InvitationOutcomeFeedback } from "@/features/pmcm-kit/model/invitation-outcome-copy";
import { clientOnboardingRepository } from "../data/client-onboarding-repository";
import { canResendPortalInvitation } from "../model/client-onboarding-rules";

type Feedback = InvitationOutcomeFeedback & { inquiryId: string };
type Resent = { before: PrismInquiry; after: PrismInquiry };

export function usePortalInvitationResendViewModel() {
  const [viewerRole, setViewerRole] = useState<PrismUserRole | null>(null);
  const [resent, setResent] = useState<Record<string, Resent>>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busyInquiryId, setBusyInquiryId] = useState<string | null>(null);

  useEffect(() => {
    setViewerRole(readStoredEventSession()?.role ?? null);
  }, []);

  /** The response's inquiry replaces the parent's copy only while that copy is still the one that was re-sent. */
  const trackedInquiry = useCallback((inquiry: PrismInquiry) => {
    const entry = resent[inquiry.id];
    return entry && entry.before === inquiry ? entry.after : inquiry;
  }, [resent]);

  const resend = useCallback(async (inquiry: PrismInquiry) => {
    setBusyInquiryId(inquiry.id);
    setFeedback(null);
    try {
      const result = await clientOnboardingRepository.resendPortalInvitation(inquiry.id);
      setResent((current) => ({ ...current, [inquiry.id]: { before: inquiry, after: result.inquiry } }));
      setFeedback({ inquiryId: inquiry.id, ...invitationOutcomeCopy(result.outcome, result.inquiry.email) });
    } catch (err) {
      const text = err instanceof Error && err.message ? err.message : "Unable to resend the invitation";
      setFeedback({ inquiryId: inquiry.id, tone: "error", text });
    } finally {
      setBusyInquiryId(null);
    }
  }, []);

  return {
    trackedInquiry,
    canResend: (inquiry: PrismInquiry) => canResendPortalInvitation(inquiry, viewerRole),
    resend,
    busyInquiryId,
    feedback,
  };
}
