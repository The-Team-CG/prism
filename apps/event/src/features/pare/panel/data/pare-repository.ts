import type { PAREApprovalRecord } from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export type PareCommands = {
  pareApprove(approvalRecordId: string): Promise<PAREApprovalRecord>;
  pareGetPending(): Promise<PAREApprovalRecord[]>;
  pareReject(approvalRecordId: string): Promise<PAREApprovalRecord>;
};

const pareCommands = {
  pareApprove: (approvalRecordId: string) =>
    eventApiRequest<PAREApprovalRecord>(`/api/ai/pare/${approvalRecordId}/approve`, { method: "PATCH" }),
  pareGetPending: () => eventApiRequest<PAREApprovalRecord[]>("/api/ai/pare/pending"),
  pareReject: (approvalRecordId: string) =>
    eventApiRequest<PAREApprovalRecord>(`/api/ai/pare/${approvalRecordId}/reject`, { method: "PATCH" }),
} satisfies PareCommands;

export function createPareRepository(commands: PareCommands = pareCommands) {
  return {
    listPending(): Promise<PAREApprovalRecord[]> {
      return commands.pareGetPending();
    },
    approve(approvalRecordId: string): Promise<PAREApprovalRecord> {
      return commands.pareApprove(approvalRecordId);
    },
    reject(approvalRecordId: string): Promise<PAREApprovalRecord> {
      return commands.pareReject(approvalRecordId);
    },
  };
}

export type PareRepository = ReturnType<typeof createPareRepository>;
