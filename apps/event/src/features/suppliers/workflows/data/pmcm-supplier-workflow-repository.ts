import type {
  CreateSupplierCreativeTaskInput,
  CreateSupplierPayableMilestoneInput,
  CreateSupplierScheduleInput,
  PrismPmcmSupplierWorkflowWorkspace,
  PrismSupplierSchedule,
  ReleaseSupplierPayoutInput,
  ReviewSupplierContractInput,
  ReverseSupplierPayoutInput,
  UpdateSupplierCreativeTaskInput,
} from "@prism/types";
import { eventApi, eventApiRequest } from "@/lib/prism-api";
import { getStorageObjectDownload } from "@prism/api-client";
import { storedEventAccessToken } from "@/lib/prism-api";

export const pmcmSupplierWorkflowRepository = {
  load: (eventId: string): Promise<PrismPmcmSupplierWorkflowWorkspace[]> => eventApi.supplierWorkflows.pmcmWorkspace(eventId),
  listSchedules: (eventId: string): Promise<PrismSupplierSchedule[]> => eventApiRequest<PrismSupplierSchedule[]>(`/api/events/${encodeURIComponent(eventId)}/supplier-schedules`),
  download: (objectId: string) => getStorageObjectDownload(objectId, { authToken: storedEventAccessToken() }),
  createSchedule: (eventId: string, input: CreateSupplierScheduleInput) => eventApi.supplierWorkflows.createSchedule(eventId, input),
  reviewContract: (versionId: string, input: ReviewSupplierContractInput) => eventApi.supplierWorkflows.reviewContract(versionId, input),
  createCreativeTask: (eventId: string, input: CreateSupplierCreativeTaskInput) => eventApi.supplierWorkflows.createCreativeTask(eventId, input),
  reviewCreativeTask: (taskId: string, input: UpdateSupplierCreativeTaskInput) => eventApi.supplierWorkflows.reviewCreativeTask(taskId, input),
  createPayable: (eventId: string, input: CreateSupplierPayableMilestoneInput) => eventApi.supplierWorkflows.createPayable(eventId, input),
  releasePayout: (milestoneId: string, input: ReleaseSupplierPayoutInput) => eventApi.supplierWorkflows.releasePayout(milestoneId, input),
  reversePayout: (recordId: string, input: ReverseSupplierPayoutInput) => eventApi.supplierWorkflows.reversePayout(recordId, input),
};
