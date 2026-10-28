import type {
  AcknowledgeSupplierScheduleInput,
  BindSupplierContractInput,
  CreateSupplierCreativeTaskInput,
  CorrectSupplierEventStatusInput,
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

export interface EventOpsSupplierWorkflowsContract {
  supplierWorkflows: {
    detail(): Promise<PrismSupplierWorkflowWorkspace>;
    createSchedule(eventId: string, input: CreateSupplierScheduleInput): Promise<unknown>;
    bindContract(requestId: string, input: BindSupplierContractInput): Promise<unknown>;
    acknowledgeSchedule(requestId: string, input: AcknowledgeSupplierScheduleInput): Promise<unknown>;
    requestScheduleChange(requestId: string, input: RequestSupplierScheduleChangeInput): Promise<unknown>;
    updateCreativeProgress(taskId: string, input: UpdateSupplierCreativeProgressInput): Promise<unknown>;
    submitCreativeTask(taskId: string, input: SubmitSupplierCreativeTaskInput): Promise<unknown>;
    pmcmWorkspace(eventId: string): Promise<PrismPmcmSupplierWorkflowWorkspace[]>;
    reviewContract(versionId: string, input: ReviewSupplierContractInput): Promise<unknown>;
    createCreativeTask(eventId: string, input: CreateSupplierCreativeTaskInput): Promise<unknown>;
    reviewCreativeTask(taskId: string, input: UpdateSupplierCreativeTaskInput): Promise<unknown>;
    createPayable(eventId: string, input: CreateSupplierPayableMilestoneInput): Promise<unknown>;
    releasePayout(milestoneId: string, input: ReleaseSupplierPayoutInput): Promise<unknown>;
    reversePayout(recordId: string, input: ReverseSupplierPayoutInput): Promise<unknown>;
    correctEventStatus(eventId: string, requestId: string, input: CorrectSupplierEventStatusInput): Promise<unknown>;
  };
}
