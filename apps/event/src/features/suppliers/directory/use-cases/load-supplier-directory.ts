import type { PmcmSupplierDirectoryQuery } from "@prism/types";
import { supplierDirectoryRepository } from "../data/supplier-directory-repository";

export function loadSupplierDirectory(query: PmcmSupplierDirectoryQuery, signal?: AbortSignal) {
  return supplierDirectoryRepository.listDirectory(query, signal);
}

export function loadSupplierCategories(signal?: AbortSignal) {
  return supplierDirectoryRepository.listCategories(signal);
}
