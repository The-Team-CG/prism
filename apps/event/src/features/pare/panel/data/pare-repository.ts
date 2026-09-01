import type { PAREApprovalRecord } from "@prism/types";
import { prismApi } from "@/lib/prism-api";

export type PareCommands = Pick<typeof prismApi, "pareApprove" | "pareGetPending" | "pareReject">;

const pareCommands = {
  pareApprove: prismApi.pareApprove,
  pareGetPending: prismApi.pareGetPending,
  pareReject: prismApi.pareReject,
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
