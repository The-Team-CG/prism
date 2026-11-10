import type { PAREApprovalRecord } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export type PareCommands = {
  pareApprove(approvalRecordId: string): Promise<PAREApprovalRecord>;
  pareGetPending(): Promise<PAREApprovalRecord[]>;
  pareReject(approvalRecordId: string): Promise<PAREApprovalRecord>;
};

const pareCommands = {
  pareApprove: (approvalRecordId: string) => eventApi.pare.approve(approvalRecordId),
  pareGetPending: () => eventApi.pare.pending(),
  pareReject: (approvalRecordId: string) => eventApi.pare.reject(approvalRecordId),
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
