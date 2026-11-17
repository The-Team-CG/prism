"use client";

import { manilaDateKey } from "@prism/ui/format-date";
import { PrivacyRequestsScreen } from "@prism/ui/privacy-requests";
import { useClientPrivacyRequestsViewModel } from "../view-models/use-client-privacy-requests-view-model";

/** The client's privacy page, on the screen clients and suppliers share. */
export function ClientPrivacyRequestsView() {
  const vm = useClientPrivacyRequestsViewModel();
  return (
    <PrivacyRequestsScreen
      requests={vm.requests}
      loading={vm.status === "loading"}
      loadError={vm.loadError}
      today={manilaDateKey()}
      draft={{ type: vm.requestType, details: vm.details, busy: vm.busy, error: vm.error, setType: vm.setRequestType, setDetails: vm.setDetails, submit: () => void vm.submit() }}
      cancel={{ busyId: vm.cancellingId, error: vm.cancelError, run: (id) => void vm.cancel(id) }}
      notice={vm.notice ? { ...vm.notice, href: "/privacy" } : { version: null, acknowledgedAt: null, href: "/privacy" }}
    />
  );
}
