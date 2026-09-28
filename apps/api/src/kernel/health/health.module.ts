import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';

/**
 * Owned tables: none.
 * Read-only: none.
 */
@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
})
export class HealthModule {}
