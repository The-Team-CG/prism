import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  PrismCommandContext,
  PrismSideEffectMode,
  PrismTransactionContext,
} from '@prism/kernel/shared-kernel';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import type { CommandReceiptKey, CommandReceiptStore } from '../ports/command-receipt.port';
import { COMMAND_RECEIPT_STORE } from '../ports/workflow-command-log.tokens';

export type WorkflowCommandDefinition<TWriteResult, TResult = TWriteResult> = {
  name: string;
  eventId?: string;
  context?: PrismCommandContext;
  sideEffectMode?: PrismSideEffectMode;
  /** Stable hash of the command input; key reuse with a different hash is rejected. */
  idempotencyPayloadHash?: string;
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
  constructor(
    @Optional() private readonly transactionRunner?: PrismTransactionRunner,
    @Optional() @Inject(COMMAND_RECEIPT_STORE) private readonly commandReceiptStore?: CommandReceiptStore,
  ) {}

  async execute<TWriteResult, TResult = TWriteResult>(
    definition: WorkflowCommandDefinition<TWriteResult, TResult>,
  ): Promise<TResult> {
    await definition.validatePermission?.();

    const receiptKey = this.receiptKey(definition);
    const receiptsEnabled = this.receiptsEnabled(receiptKey, definition);
    if (receiptsEnabled) {
      const replay = await this.commandReceiptStore!.find(receiptKey!);
      if (replay) return this.replay<TResult>(replay, definition.idempotencyPayloadHash);
    }

    await definition.validateState?.();

    const runWrite = this.writeRunner(definition);
    if (receiptsEnabled) return this.executeWithReceipt(definition, receiptKey!, runWrite);
    return this.executeWithoutReceipt(definition, runWrite);
  }

  private writeRunner<TWriteResult, TResult>(definition: WorkflowCommandDefinition<TWriteResult, TResult>) {
    return async (transactionContext?: PrismTransactionContext) => {
      if (transactionContext) await definition.validateStateInTransaction?.(transactionContext);
      const result = await definition.write(transactionContext);
      await definition.sideEffects?.(result, transactionContext);
      return result;
    };
  }

  private async executeWithReceipt<TWriteResult, TResult>(
    definition: WorkflowCommandDefinition<TWriteResult, TResult>,
    receiptKey: CommandReceiptKey,
    runWrite: (transactionContext?: PrismTransactionContext) => Promise<TWriteResult>,
  ): Promise<TResult> {
    try {
      const result = await this.transactionRunner!.run(async (transactionContext) => {
        const replay = await this.commandReceiptStore!.find(receiptKey, transactionContext);
        if (replay) return this.replay<TResult>(replay, definition.idempotencyPayloadHash);

        const receipt = await this.commandReceiptStore!.create(
          {
            ...receiptKey,
            actorRole: definition.context!.actorRole,
            eventId: definition.context!.eventId,
            correlationId: definition.context!.correlationId,
            payloadHash: definition.idempotencyPayloadHash,
          },
          transactionContext,
        );
        const written = await runWrite(transactionContext);
        const projected = definition.project ? definition.project(written) : (written as unknown as TResult);
        await this.commandReceiptStore!.complete(receipt.id, projected, transactionContext);
        return projected;
      }, definition.context);
      return result as TResult;
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const replay = await this.commandReceiptStore!.find(receiptKey);
      if (!replay) throw error;
      return this.replay<TResult>(replay, definition.idempotencyPayloadHash);
    }
  }

  private async executeWithoutReceipt<TWriteResult, TResult>(
    definition: WorkflowCommandDefinition<TWriteResult, TResult>,
    runWrite: (transactionContext?: PrismTransactionContext) => Promise<TWriteResult>,
  ): Promise<TResult> {
    const result =
      definition.sideEffectMode === 'same_tx' && this.transactionRunner
        ? await this.transactionRunner.run(runWrite, definition.context)
        : await runWrite();
    return definition.project ? definition.project(result) : (result as unknown as TResult);
  }

  private receiptsEnabled<TWriteResult, TResult>(
    receiptKey: CommandReceiptKey | null,
    definition: WorkflowCommandDefinition<TWriteResult, TResult>,
  ): boolean {
    return Boolean(receiptKey && this.commandReceiptStore && this.transactionRunner && definition.sideEffectMode === 'same_tx');
  }

  private receiptKey<TWriteResult, TResult>(definition: WorkflowCommandDefinition<TWriteResult, TResult>): CommandReceiptKey | null {
    if (!definition.context?.idempotencyKey || !definition.idempotencyPayloadHash) return null;
    return {
      commandName: definition.name,
      idempotencyKey: definition.context.idempotencyKey,
      actorId: definition.context.actorId,
    };
  }

  private replay<TResult>(receipt: { payloadHash: string | null; result: unknown }, payloadHash?: string): TResult {
    if ((receipt.payloadHash ?? null) !== (payloadHash ?? null)) {
      throw new BadRequestException('Command idempotency key was reused for different content');
    }
    return receipt.result as TResult;
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code === 'P2002'
      : Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
  }
}
