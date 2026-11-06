import { describe, expect, it, vi } from 'vitest';
import { AiTriageRecordEraser } from './ai-triage-record-eraser.service';

function transaction(records: Array<{ id: string; aiAuditLogId: string }>, audits: Array<{ id: string; sanitizedPayload: unknown }>) {
  return {
    opsAiApprovalRecord: {
      findMany: vi.fn(async () => records),
      deleteMany: vi.fn(async () => ({ count: records.length })),
    },
    opsAiAuditLog: {
      findMany: vi.fn(async () => audits),
      update: vi.fn(async () => undefined),
    },
  };
}

describe('AiTriageRecordEraser', () => {
  it('does nothing and touches no table when no inquiry was erased', async () => {
    const tx = transaction([], []);
    await expect(new AiTriageRecordEraser().eraseForInquiries([], tx as never)).resolves.toEqual({ surfaces: [], touchedRecords: 0 });
    expect(tx.opsAiApprovalRecord.findMany).not.toHaveBeenCalled();
  });

  it('only looks for triage advice that belongs to the erased inquiries', async () => {
    const tx = transaction([], []);
    const result = await new AiTriageRecordEraser().eraseForInquiries(['inq_1', 'inq_2'], tx as never);

    expect(result).toEqual({ surfaces: [], touchedRecords: 0 });
    expect(tx.opsAiApprovalRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        featureName: 'FR-AI-01',
        OR: [
          { sourceDispatchId: { startsWith: 'inquiry-triage:inq_1:' } },
          { sourceDispatchId: { startsWith: 'inquiry-triage:inq_2:' } },
        ],
      },
    }));
    expect(tx.opsAiApprovalRecord.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes the advice and strips the applicant wording from its audit row, keeping route evidence', async () => {
    const route = { routeRevision: 'r'.repeat(64), routePolicyOutcome: 'test_data_approved', endpointPolicyId: 'anthropic-direct' };
    const tx = transaction(
      [{ id: 'rec_1', aiAuditLogId: 'aia_req_1' }],
      [{ id: 'aia_req_1', sanitizedPayload: { message: 'We need a venue for 200 guests', inquiryId: '[identifier redacted]', _aiGatewayRoute: route } }],
    );

    const result = await new AiTriageRecordEraser().eraseForInquiries(['inq_1'], tx as never);

    expect(result).toEqual({ surfaces: ['ai_triage'], touchedRecords: 1 });
    expect(tx.opsAiAuditLog.update).toHaveBeenCalledWith({
      where: { id: 'aia_req_1' },
      data: { sanitizedPayload: { _aiGatewayRoute: route, _erased: 'erased-for-privacy' } },
    });
    expect(JSON.stringify(tx.opsAiAuditLog.update.mock.calls)).not.toContain('200 guests');
    expect(tx.opsAiApprovalRecord.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['rec_1'] } } });
  });
});
