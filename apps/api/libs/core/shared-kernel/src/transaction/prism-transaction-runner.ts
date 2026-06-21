import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '@prism/database';
import type { PrismCommandContext, PrismTransactionContext } from './prism-command-context';

@Injectable()
export class PrismTransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(
    work: (context: PrismTransactionContext) => Promise<T>,
    commandContext: Partial<PrismCommandContext> = {},
  ): Promise<T> {
    const correlationId = commandContext.correlationId ?? `cmd_${randomUUID()}`;
    return this.prisma.$transaction((tx) =>
      work({
        prisma: tx,
        correlationId,
        actorId: commandContext.actorId,
      }),
    );
  }
}