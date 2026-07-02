import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { IdentityOpsModule } from '@prism/modules/identity-ops';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [DatabaseModule, AccessControlModule, IdentityOpsModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}