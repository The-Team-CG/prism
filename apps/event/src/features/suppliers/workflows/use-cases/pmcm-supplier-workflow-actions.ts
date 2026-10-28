import {
  createSupplierCreativeTaskSchema,
  createSupplierPayableMilestoneSchema,
  createSupplierScheduleSchema,
  parseContract,
  releaseSupplierPayoutSchema,
  reviewSupplierContractSchema,
  reverseSupplierPayoutSchema,
  updateSupplierCreativeTaskSchema,
  type CreateSupplierCreativeTaskInput,
  type CreateSupplierPayableMilestoneInput,
  type CreateSupplierScheduleInput,
  type ReleaseSupplierPayoutInput,
  type ReviewSupplierContractInput,
  type ReverseSupplierPayoutInput,
  type UpdateSupplierCreativeTaskInput,
} from "@prism/types";
import { pmcmSupplierWorkflowRepository } from "../data/pmcm-supplier-workflow-repository";

export const loadPmcmSupplierWorkflows = (eventId: string) => pmcmSupplierWorkflowRepository.load(eventId);
export const loadPmcmSupplierScheduleWindows = (eventId: string) => pmcmSupplierWorkflowRepository.listSchedules(eventId);
export const downloadPmcmSupplierFile = (objectId: string) => pmcmSupplierWorkflowRepository.download(objectId);

export function publishSupplierSchedule(eventId: string, input: CreateSupplierScheduleInput) {
  return pmcmSupplierWorkflowRepository.createSchedule(eventId, parseContract(createSupplierScheduleSchema, input, "Supplier schedule"));
}

export function reviewSupplierContract(versionId: string, input: ReviewSupplierContractInput) {
  return pmcmSupplierWorkflowRepository.reviewContract(versionId, parseContract(reviewSupplierContractSchema, input, "Supplier contract review"));
}

export function assignSupplierCreativeTask(eventId: string, input: CreateSupplierCreativeTaskInput) {
  return pmcmSupplierWorkflowRepository.createCreativeTask(eventId, parseContract(createSupplierCreativeTaskSchema, input, "Supplier deliverable"));
}

export function reviewSupplierCreativeTask(taskId: string, input: UpdateSupplierCreativeTaskInput) {
  return pmcmSupplierWorkflowRepository.reviewCreativeTask(taskId, parseContract(updateSupplierCreativeTaskSchema, input, "Supplier deliverable review"));
}

export function createSupplierPayable(eventId: string, input: CreateSupplierPayableMilestoneInput) {
  return pmcmSupplierWorkflowRepository.createPayable(eventId, parseContract(createSupplierPayableMilestoneSchema, input, "Supplier payable"));
}

export function recordSupplierPayout(milestoneId: string, input: ReleaseSupplierPayoutInput) {
  return pmcmSupplierWorkflowRepository.releasePayout(milestoneId, parseContract(releaseSupplierPayoutSchema, input, "Supplier payment release"));
}

export function reverseSupplierPayout(recordId: string, input: ReverseSupplierPayoutInput) {
  return pmcmSupplierWorkflowRepository.reversePayout(recordId, parseContract(reverseSupplierPayoutSchema, input, "Supplier payment reversal"));
}
