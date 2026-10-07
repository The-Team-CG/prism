import type { PmcmSupplierHistoryQuery, PmcmSupplierProfileQuery, PmcmSupplierRecordsQuery } from "@prism/types";
import { supplierDirectoryRepository } from "../data/supplier-directory-repository";

export function loadSupplierDetail(supplierId: string, query: PmcmSupplierProfileQuery, signal?: AbortSignal) {
  return supplierDirectoryRepository.getProfile(supplierId, query, signal);
}

export function loadSupplierReviews(supplierId: string, query: PmcmSupplierHistoryQuery, signal?: AbortSignal) {
  return supplierDirectoryRepository.listReviews(supplierId, query, signal);
}

export function loadSupplierCertifications(supplierId: string, query: PmcmSupplierHistoryQuery, signal?: AbortSignal) {
  return supplierDirectoryRepository.listCertifications(supplierId, query, signal);
}

export function loadSupplierRecords(supplierId: string, query: PmcmSupplierRecordsQuery, signal?: AbortSignal) {
  return supplierDirectoryRepository.listRecords(supplierId, query, signal);
}

export function loadSupplierEngagements(supplierId: string, query: PmcmSupplierHistoryQuery, signal?: AbortSignal) {
  return supplierDirectoryRepository.listEngagements(supplierId, query, signal);
}
