import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { CommandReceiptCreate, CommandReceiptKey, CommandReceiptRecord, CommandReceiptStore } from '@prism/kernel/event-core';

@Injectable()
export class PlatformCommandReceiptStore implements CommandReceiptStore {
  constructor(private readonly prisma: PrismaService) {}

  async find(key: CommandReceiptKey, context?: PrismTransactionContext): Promise<CommandReceiptRecord | null> {
    return this.database(context).opsCommandReceipt.findUnique({
      where: { commandName_idempotencyKey_actorId_eventScope: key },
    });
  }

  async create(input: CommandReceiptCreate, context: PrismTransactionContext): Promise<{ id: string }> {
    const row = await this.database(context).opsCommandReceipt.create({
      data: {
        id: `cmd_receipt_${randomUUID()}`,
        commandName: input.commandName,
        idempotencyKey: input.idempotencyKey,
        actorId: input.actorId,
        eventScope: input.eventScope,
        actorRole: input.actorRole,
        eventId: input.eventId ?? null,
        correlationId: input.correlationId,
        payloadHash: input.payloadHash ?? null,
      },
      select: { id: true },
    });
    return row;
  }

  async complete(id: string, result: unknown, context: PrismTransactionContext): Promise<void> {
    await this.database(context).opsCommandReceipt.update({
      where: { id },
      data: {
        result: result === undefined ? Prisma.JsonNull : (result as Prisma.InputJsonValue),
        completedAt: new Date(),
      },
    });
  }

  private database(context?: PrismTransactionContext): PrismaService | Prisma.TransactionClient {
    return context?.prisma ?? this.prisma;
  }
}
