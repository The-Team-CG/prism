/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismApprovedClientAccount, PrismEventClientAccess } from "@prism/types";

vi.mock("../data/client-floorplan-access-repository", () => ({
  clientFloorplanAccessRepository: {
    listAccess: vi.fn(),
    searchCandidates: vi.fn(),
    grant: vi.fn(),
    revoke: vi.fn(),
  },
}));

import { clientFloorplanAccessRepository } from "../data/client-floorplan-access-repository";
import { useClientFloorplanAccessViewModel } from "./use-client-floorplan-access-view-model";

const PRIMARY = { name: "Ana Reyes", email: "ana@example.test" };
const PRIMARY_ACCOUNT: PrismApprovedClientAccount = {
  id: "primary",
  name: "Ana Reyes",
  email: "ana@example.test",
};
const CATHY: PrismApprovedClientAccount = {
  id: "client_3",
  name: "Cathy Lim",
  email: "cathy@example.test",
};
const BEN: PrismApprovedClientAccount = {
  id: "client_2",
  name: "Ben Cruz",
  email: "ben@example.test",
};

function access(secondaryContacts: PrismApprovedClientAccount[] = []): PrismEventClientAccess {
  return { eventId: "evt_1", primaryContact: PRIMARY, secondaryContacts };
}

describe("useClientFloorplanAccessViewModel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(clientFloorplanAccessRepository.listAccess).mockResolvedValue(access());
    vi.mocked(clientFloorplanAccessRepository.searchCandidates).mockResolvedValue([CATHY]);
  });

  it("filters primary/active accounts and applies idempotent grant and revoke responses", async () => {
    vi.mocked(clientFloorplanAccessRepository.listAccess).mockResolvedValue(access([BEN]));
    vi.mocked(clientFloorplanAccessRepository.searchCandidates).mockResolvedValue([PRIMARY_ACCOUNT, CATHY, BEN]);
    vi.mocked(clientFloorplanAccessRepository.grant).mockResolvedValue(access([BEN, CATHY]));
    vi.mocked(clientFloorplanAccessRepository.revoke).mockResolvedValue(access([BEN]));

    const { result } = renderHook(() => useClientFloorplanAccessViewModel("evt_1"));
    await waitFor(() => expect(result.current.access).toEqual(access([BEN])));

    await act(async () => result.current.search("cathy"));
    expect(result.current.candidates).toEqual([CATHY]);

    await act(async () => result.current.grant(CATHY.id));
    expect(clientFloorplanAccessRepository.grant).toHaveBeenCalledWith("evt_1", CATHY.id);
    expect(result.current.access).toEqual(access([BEN, CATHY]));

    await act(async () => result.current.revoke(CATHY.id));
    expect(clientFloorplanAccessRepository.revoke).toHaveBeenCalledWith("evt_1", CATHY.id);
    expect(result.current.access).toEqual(access([BEN]));
  });

  it("surfaces server errors and keeps the last good access payload", async () => {
    vi.mocked(clientFloorplanAccessRepository.listAccess).mockResolvedValue(access([BEN]));
    const { result } = renderHook(() => useClientFloorplanAccessViewModel("evt_1"));
    await waitFor(() => expect(result.current.access).toEqual(access([BEN])));

    vi.mocked(clientFloorplanAccessRepository.revoke).mockRejectedValue(new Error("Access denied"));
    await act(async () => result.current.revoke(BEN.id));

    expect(result.current.access).toEqual(access([BEN]));
    expect(result.current.error).toBe("Access denied");
  });

  it("does not call grant or revoke before access data is available", async () => {
    let resolveAccess!: (value: PrismEventClientAccess) => void;
    vi.mocked(clientFloorplanAccessRepository.listAccess).mockReturnValue(
      new Promise((resolve) => { resolveAccess = resolve; }),
    );
    const { result } = renderHook(() => useClientFloorplanAccessViewModel("evt_1"));

    await act(async () => {
      await result.current.grant(CATHY.id);
      await result.current.revoke(CATHY.id);
    });

    expect(clientFloorplanAccessRepository.grant).not.toHaveBeenCalled();
    expect(clientFloorplanAccessRepository.revoke).not.toHaveBeenCalled();
    await act(async () => resolveAccess(access()));
  });
});
