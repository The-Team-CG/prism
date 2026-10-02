import { Injectable } from '@nestjs/common';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import type { AuditLogFilters, PrismVerifiedEventActor } from '@prism/types';
import { AuditService } from './audit.service';
import { AuditReadService } from './audit-read.service';

const BULK_EXPORT_ALERT_THRESHOLD = 25;

@Injectable()
export class AuditExportService {
  constructor(
    private readonly auditReadService: AuditReadService,
    private readonly auditService: AuditService,
  ) {}

  async exportAuditLogs(
    input: AuditLogFilters = {},
    actor?: Pick<PrismVerifiedEventActor, 'id' | 'name' | 'role' | 'email'>,
  ) {
    const logs = await this.auditReadService.listAuditLogs({ ...input, limit: input.limit ?? '500' });

    await this.auditService.audit(undefined, actor?.name ?? 'System', `Exported audit log (${logs.length} records)`, {
      actorRole: actor?.role ?? OpsUserRole.System,
      actorEmail: actor?.email,
      actionType: AuditActionType.Export,
      category: AuditCategory.Access,
      affectedType: 'audit_logs',
      affectedLabel: `${logs.length} records`,
      metadata: { filters: input, recordCount: logs.length, actorId: actor?.id ?? null },
    });

    if (logs.length >= BULK_EXPORT_ALERT_THRESHOLD) {
      await this.auditService.createSecurityAlert({
        type: 'bulk_export',
        title: 'Bulk audit export threshold exceeded',
        description: `${actor?.name ?? 'System'} exported ${logs.length} audit records.`,
        severity: 'warning',
        triggeredBy: actor?.name ?? 'System',
        metadata: {
          filters: input,
          recordCount: logs.length,
          threshold: BULK_EXPORT_ALERT_THRESHOLD,
          actorId: actor?.id ?? null,
          actorEmail: actor?.email ?? null,
        },
      });
    }

    return {
      exportedAt: new Date().toISOString(),
      recordCount: logs.length,
      rows: logs,
    };
  }
}
