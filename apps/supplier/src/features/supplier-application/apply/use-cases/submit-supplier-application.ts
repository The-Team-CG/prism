import { supplierApplicationRepository } from "../data/supplier-application-repository";
import { buildSupplierApplicationPayload } from "../model/supplier-application-rules";
import type { SupplierApplicationForm } from "../model/supplier-application-types";

export async function submitSupplierApplication(form: SupplierApplicationForm) {
  const payload = buildSupplierApplicationPayload(form);
  return supplierApplicationRepository.create(payload);
}
