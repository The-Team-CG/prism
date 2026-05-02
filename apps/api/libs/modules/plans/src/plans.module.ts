import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
