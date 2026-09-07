import { Injectable, Optional } from '@nestjs/common';
import type {
  PrismCommandContext,
  PrismSideEffectMode,
  PrismTransactionContext,
} from '@prism/kernel/shared-kernel';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';

export type WorkflowCommandDefinition<TWriteResult, TResult = TWriteResult> = {
  name: string;
  eventId?: string;
  context?: PrismCommandContext;
  sideEffectMode?: PrismSideEffectMode;
  validatePermission?: () => Promise<void> | void;
  validateState?: () => Promise<void> | void;
  /** State checks that must run after the transaction has started. */
  validateStateInTransaction?: (transactionContext: PrismTransactionContext) => Promise<void> | void;
  write: (transactionContext?: PrismTransactionContext) => Promise<TWriteResult>;
  sideEffects?: (result: TWriteResult, transactionContext?: PrismTransactionContext) => Promise<void> | void;
  project?: (result: TWriteResult) => TResult;
};

@Injectable()
export class WorkflowCommandService {
  constructor(@Optional() private readonly transactionRunner?: PrismTransactionRunner) {}

  async execute<TWriteResult, TResult = TWriteResult>(
    definition: WorkflowCommandDefinition<TWriteResult, TResult>,
  ): Promise<TResult> {
    await definition.validatePermission?.();
    await definition.validateState?.();

    const runWrite = async (transactionContext?: PrismTransactionContext) => {
      if (transactionContext) await definition.validateStateInTransaction?.(transactionContext);
      const result = await definition.write(transactionContext);
      await definition.sideEffects?.(result, transactionContext);
      return result;
    };

    const result =
      definition.sideEffectMode === 'same_tx' && this.transactionRunner
        ? await this.transactionRunner.run(runWrite, definition.context)
        : await runWrite();

    return definition.project ? definition.project(result) : (result as unknown as TResult);
  }
}
