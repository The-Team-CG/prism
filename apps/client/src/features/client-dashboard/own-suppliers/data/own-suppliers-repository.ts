import type { CreateClientOwnedSupplierInput, PrismClientOwnedSupplier } from "@prism/types";
import { clientApiRequest } from "@/lib/prism-api";

const base = (eventId: string) => `/events/${encodeURIComponent(eventId)}/client-owned-suppliers`;

export const ownSuppliersRepository = {
  list: (eventId: string) => clientApiRequest<PrismClientOwnedSupplier[]>(base(eventId)),
  create: (eventId: string, input: CreateClientOwnedSupplierInput) => clientApiRequest<PrismClientOwnedSupplier>(base(eventId), { method: "POST", body: input }),
  confirm: (eventId: string, id: string) => clientApiRequest<PrismClientOwnedSupplier>(`${base(eventId)}/${encodeURIComponent(id)}/confirm`, { method: "POST" }),
};
