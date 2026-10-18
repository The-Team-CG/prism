import type {
  AcknowledgeSupplierScheduleInput,
  BindSupplierContractInput,
  CreateSupplierCreativeTaskInput,
  CreateSupplierPayableMilestoneInput,
  CreateSupplierScheduleInput,
  PrismPmcmSupplierWorkflowWorkspace,
  PrismSupplierWorkflowWorkspace,
  ReleaseSupplierPayoutInput,
  RequestSupplierScheduleChangeInput,
  ReviewSupplierContractInput,
  ReverseSupplierPayoutInput,
  SubmitSupplierCreativeTaskInput,
  UpdateSupplierCreativeProgressInput,
  UpdateSupplierCreativeTaskInput,
} from '@prism/types';
import { prismRequest } from '../http';
import type { EventOpsClient, EventOpsClientOptions } from './contracts';
import { actorPath, withBase } from './shared';

export function createSupplierWorkflowsClient(options: EventOpsClientOptions): Pick<EventOpsClient, 'supplierWorkflows'> {
  return {
    supplierWorkflows: {
      detail: () => prismRequest<PrismSupplierWorkflowWorkspace>('/supplier/workflows', withBase(options)),
      createSchedule: (eventId: string, input: CreateSupplierScheduleInput) => prismRequest(
        actorPath(`/events/${eventId}/supplier-schedules`), withBase(options, { method: 'POST', body: input }),
      ),
      bindContract: (requestId: string, input: BindSupplierContractInput) => prismRequest(
        `/supplier/quote-requests/${requestId}/contracts`, withBase(options, { method: 'POST', body: input }),
      ),
      acknowledgeSchedule: (requestId: string, input: AcknowledgeSupplierScheduleInput) => prismRequest(
        `/supplier/quote-requests/${requestId}/schedule/acknowledgement`, withBase(options, { method: 'POST', body: input }),
      ),
      requestScheduleChange: (requestId: string, input: RequestSupplierScheduleChangeInput) => prismRequest(
        `/supplier/quote-requests/${requestId}/schedule/change-request`, withBase(options, { method: 'POST', body: input }),
      ),
      updateCreativeProgress: (taskId: string, input: UpdateSupplierCreativeProgressInput) => prismRequest(
        `/supplier/creative-tasks/${taskId}/progress`, withBase(options, { method: 'PATCH', body: input }),
      ),
      submitCreativeTask: (taskId: string, input: SubmitSupplierCreativeTaskInput) => prismRequest(
        `/supplier/creative-tasks/${taskId}/submissions`, withBase(options, { method: 'POST', body: input }),
      ),
      pmcmWorkspace: (eventId: string) => prismRequest<PrismPmcmSupplierWorkflowWorkspace[]>(
        actorPath(`/events/${eventId}/supplier-workflows`), withBase(options),
      ),
      reviewContract: (versionId: string, input: ReviewSupplierContractInput) => prismRequest(
        `/supplier/contracts/${versionId}/review`, withBase(options, { method: 'PATCH', body: input }),
      ),
      createCreativeTask: (eventId: string, input: CreateSupplierCreativeTaskInput) => prismRequest(
        `/events/${eventId}/supplier-creative-tasks`, withBase(options, { method: 'POST', body: input }),
      ),
      reviewCreativeTask: (taskId: string, input: UpdateSupplierCreativeTaskInput) => prismRequest(
        `/supplier/creative-tasks/${taskId}/review`, withBase(options, { method: 'PATCH', body: input }),
      ),
      createPayable: (eventId: string, input: CreateSupplierPayableMilestoneInput) => prismRequest(
        actorPath(`/events/${eventId}/supplier-payable-milestones`), withBase(options, { method: 'POST', body: input }),
      ),
      releasePayout: (milestoneId: string, input: ReleaseSupplierPayoutInput) => prismRequest(
        `/supplier-payable-milestones/${milestoneId}/releases`, withBase(options, { method: 'POST', body: input }),
      ),
      reversePayout: (recordId: string, input: ReverseSupplierPayoutInput) => prismRequest(
        `/supplier-payout-records/${recordId}/reversal`, withBase(options, { method: 'POST', body: input }),
      ),
    },
  };
}
