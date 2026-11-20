"use client";

import { InquiryViews } from "./inquiry-views";
import { ClientOnboardingTracker } from "@/features/clients/onboarding";
import { InquiryIntakeLog } from "@/features/inquiries/intake";
import { inquiryFunnel } from "@/features/inquiries/intake/model/inquiry-intake-rules";
import { ConformeDraftReviewView } from "@/features/inquiries/conforme-drafts";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardInquiriesSectionView() {
  const {
    reference,
    acceptInquiry,
    pendInquiry,
    declineInquiry,
    mergeInquiry,
    logInquiryOnBehalf,
    busy,
    openConformeUpload,
    sendConformeReminder,
  } = useEventDashboardLoadedRouteViewModel();
  return (
    <InquiryViews
      funnel={inquiryFunnel(reference.inquiries)}
      intake={
        <InquiryIntakeLog
          inquiries={reference.inquiries}
          onAccept={acceptInquiry}
          onPend={pendInquiry}
          onDecline={declineInquiry}
          onMerge={mergeInquiry}
          onLogOnBehalf={logInquiryOnBehalf}
          busy={Boolean(busy)}
        />
      }
      onboarding={
        <ClientOnboardingTracker
          inquiries={reference.inquiries}
          onUploadConforme={openConformeUpload}
          onSendReminder={sendConformeReminder}
          busy={Boolean(busy)}
        />
      }
      followUp={<ConformeDraftReviewView inquiries={reference.inquiries} />}
    />
  );
}
