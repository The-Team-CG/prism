"use client";

import { ChatWorkspace, ViberMessagePrompt } from "@prism/ui/chat";
import { notificationPreferencesRepository } from "../../../notifications/data/notification-preferences-repository";
import type { PrismAuthenticatedSession } from "@prism/types";
import { supplierMessageEvents } from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuoteRequest, PrismSupplierReadinessBoard } from "../../model/supplier-workspace-types";
import { useSupplierMessagesViewModel } from "../../view-models/use-supplier-messages-view-model";

export function MessagesPage({ session, selectedRequests, readinessBoard }: { session: PrismAuthenticatedSession; selectedRequests: PrismSupplierQuoteRequest[]; readinessBoard: PrismSupplierReadinessBoard | null }) {
  const vm = useSupplierMessagesViewModel({ events: supplierMessageEvents(selectedRequests, readinessBoard?.items ?? []), session });
  return (
    <ChatWorkspace
      ariaLabel="Messages with PMCM"
      {...vm.workspace}
      notificationPrompt={<ViberMessagePrompt actions={notificationPreferencesRepository} href="/dashboard/notifications#viber-settings" />}
      compose={vm.compose}
      composerPlaceholder={() => "Reply to PMCM"}
      empty={{ title: "No messages yet", body: "Messages appear after a booking is linked to an event." }}
    />
  );
}
