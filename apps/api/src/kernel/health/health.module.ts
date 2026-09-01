import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/**
 * Owned tables: none.
 * Read-only: none.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
