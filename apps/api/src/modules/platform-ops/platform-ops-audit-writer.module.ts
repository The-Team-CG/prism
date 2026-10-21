import { Global, Module } from '@nestjs/common';
import { AUDIT_WRITER } from '@prism/kernel/access-control';
import { AI_GATEWAY_HEALTH_STATUS, type AiGatewayHealthStatus } from '@prism/kernel/health';
import { AuditWriterAdapter } from './infrastructure/trust/audit-writer.adapter';
import { PlatformOpsModule } from './platform-ops.module';
import {
  AI_GATEWAY_RUNTIME_CONFIG,
  type AiGatewayRuntimeConfig,
} from './application/ai-governance/gateway/ai-gateway.config';

/**
 * Composition-root bridge for kernel consumers that need to record an audit
 * event without depending on the platform-ops implementation.
 */
@Global()
@Module({
  imports: [PlatformOpsModule],
  providers: [
    { provide: AUDIT_WRITER, useExisting: AuditWriterAdapter },
    {
      provide: AI_GATEWAY_HEALTH_STATUS,
      inject: [AI_GATEWAY_RUNTIME_CONFIG],
      useFactory: (runtime: AiGatewayRuntimeConfig): AiGatewayHealthStatus => ({
        profile: runtime.profileId,
        providerCallsEnabled: runtime.liveUseCases.size > 0,
      }),
    },
  ],
  exports: [AUDIT_WRITER, AI_GATEWAY_HEALTH_STATUS],
})
export class PlatformOpsAuditWriterModule {}
