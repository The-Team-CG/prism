import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { OpsPareDispatch } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PareDispatchWriteInput, PareDispatchWriter } from '../../../contracts/ai-governance/pare-dispatch-writer.port';
import type { PareDispatchExecutor } from './pare-dispatch-worker';
import { processPareDispatchQueue } from './pare-dispatch-worker';
import { PAREService } from './pare.service';

@Injectable()
export class PareDispatchOutboxService implements PareDispatchWriter, OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private inFlight?: Promise<void>;
  private readonly logger = new Logger(PareDispatchOutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pareService: PAREService,
  ) {}

  async queue(input: PareDispatchWriteInput, context?: PrismTransactionContext): Promise<OpsPareDispatch> {
    const prisma = context?.prisma ?? this.prisma;
    const data = {
      id: `pare_dispatch_${randomUUID()}`,
      eventId: input.eventId,
      requestId: input.requestId,
      sourceUpdatedAt: input.sourceUpdatedAt,
      status: 'queued',
      attempts: 0,
      correlationId: input.correlationId,
      nextAttemptAt: new Date(),
    };
    return prisma.opsPareDispatch.upsert({
      where: { requestId_sourceUpdatedAt: { requestId: input.requestId, sourceUpdatedAt: input.sourceUpdatedAt } },
      create: data,
      update: { sourceUpdatedAt: input.sourceUpdatedAt },
    });
  }

  async processQueued(options: { maxAttempts?: number; maxBatch?: number } = {}) {
    return processPareDispatchQueue(this.prisma, this.pareService as PareDispatchExecutor, options.maxAttempts, options.maxBatch);
  }

  onApplicationBootstrap() {
    this.timer = setInterval(() => { void this.runScheduled(); }, 30_000);
    this.timer.unref();
    void this.runScheduled();
  }

  async onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }

  private runScheduled(): Promise<void> {
    if (this.running) return this.inFlight ?? Promise.resolve();
    this.running = true;
    const work = this.processQueued()
      .catch(() => {
        this.logger.warn('PARE dispatch sweep failed; durable work remains available for retry');
      })
      .then(() => undefined);
    this.inFlight = work;
    void work.finally(() => {
      if (this.inFlight === work) this.inFlight = undefined;
      this.running = false;
    });
    return work;
  }
}
