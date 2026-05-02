import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PublishController],
  providers: [PublishService],
})
export class PublishingModule {}
