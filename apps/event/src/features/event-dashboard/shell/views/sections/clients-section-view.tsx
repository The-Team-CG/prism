"use client";

import { ClientDirectory, ClientDossier } from "./client-directory";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

const phpMoney = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

export function EventDashboardClientsSectionView() {
  const { selectedClient, reference, clientRecordsForView, navigateClient, navigateSection, navigateEvent, routeState } =
    useEventDashboardLoadedRouteViewModel();
  const balanceOf = (events: Array<{ id: string }>) =>
    events.reduce((sum, event) => sum + (reference.outstandingBalanceByEvent[event.id] ?? 0), 0);
  if (selectedClient) {
    const balance = balanceOf(selectedClient.events);
    return (
      <ClientDossier
        client={selectedClient}
        balance={phpMoney.format(balance)}
        onBack={() => navigateSection("clients")}
        view={routeState.view}
        onOpenEvent={(id, tab) => navigateEvent(id, tab ?? "overview")}
      />
    );
  }
  const balances = new Map(clientRecordsForView.map((client) => [client.id, balanceOf(client.events)] as const));
  return <ClientDirectory clients={clientRecordsForView} balances={balances} onOpenClient={navigateClient} />;
}

/** Team routes whose data isn't modelled separately yet say so, instead of silently repeating the roster. */
