import { Module } from '@nestjs/common';
import { AuditService } from '@prism/contexts/platform-ops';
import { DatabaseModule, PrismaService } from '@prism/kernel/database';
import { LocalFixtureSeeder } from './local-fixture-seeder';

const auditServiceProvider = {
  provide: AuditService,
  useFactory: (prisma: PrismaService) => new AuditService(prisma),
  inject: [PrismaService],
};

@Module({
  imports: [DatabaseModule],
  providers: [auditServiceProvider, LocalFixtureSeeder],
  exports: [LocalFixtureSeeder],
})
export class LocalFixturesModule {}
