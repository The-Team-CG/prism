import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SchemaCompatibilityService } from './schema-compatibility.service';

@Module({
  providers: [PrismaService, SchemaCompatibilityService],
  exports: [PrismaService],
})
export class DatabaseModule {}
