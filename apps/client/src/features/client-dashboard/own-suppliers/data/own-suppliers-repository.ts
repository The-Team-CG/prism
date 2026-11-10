import type { CreateClientOwnedSupplierInput } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export const ownSuppliersRepository = {
  list: (eventId: string) => clientApi.commercial.clientOwnedSuppliers(eventId),
  create: (eventId: string, input: CreateClientOwnedSupplierInput) => clientApi.commercial.createClientOwnedSupplier(eventId, input),
  confirm: (eventId: string, id: string) => clientApi.commercial.confirmClientOwnedSupplier(eventId, id),
};
