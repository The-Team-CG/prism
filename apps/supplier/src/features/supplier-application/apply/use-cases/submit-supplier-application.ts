import { supplierApplicationRepository } from "../data/supplier-application-repository";
import { buildSupplierApplicationPayload } from "../model/supplier-application-rules";
import type { SupplierApplicationForm } from "../model/supplier-application-types";
import { createSupplierApplicationSchema, parseContract } from "@prism/types";

export async function submitSupplierApplication(form: SupplierApplicationForm) {
  const payload = parseContract(
    createSupplierApplicationSchema,
    buildSupplierApplicationPayload(form),
    "Supplier application",
  );
  return supplierApplicationRepository.create(payload);
}
