import type { PAREApprovalRecord } from "@prism/types";
import type { EventOpsCommands } from "@/features/event-ops";

export function createPareRepository(commands: EventOpsCommands) {
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
