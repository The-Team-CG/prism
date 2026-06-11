export type WorkflowCommandDefinition<TWriteResult, TResult = TWriteResult> = {
  name: string;
  eventId?: string;
  validatePermission?: () => Promise<void> | void;
  validateState?: () => Promise<void> | void;
  write: () => Promise<TWriteResult>;
  sideEffects?: (result: TWriteResult) => Promise<void> | void;
  project?: (result: TWriteResult) => TResult;
};

export class WorkflowCommandService {
  async execute<TWriteResult, TResult = TWriteResult>(
    definition: WorkflowCommandDefinition<TWriteResult, TResult>,
  ): Promise<TResult> {
    await definition.validatePermission?.();
    await definition.validateState?.();
    const result = await definition.write();
    await definition.sideEffects?.(result);
    return definition.project ? definition.project(result) : (result as unknown as TResult);
  }
}
