import { clearPrismSession, PRISM_SESSION_STORAGE_KEYS } from "@prism/types";
import { supplierApi } from "@/lib/prism-api";

/** Opens the change-of-email link; needs no session. */
export const confirmSupplierEmailChange = (token: string) => supplierApi.auth.confirmEmailChange(token);

/** Every session ended with the change, so the one this browser kept goes too. */
export const forgetSupplierSession = () => clearPrismSession(PRISM_SESSION_STORAGE_KEYS.supplier);
