/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismUser } from "@prism/types";

const repositoryMock = vi.hoisted(() => ({
  unlockUser: vi.fn(),
  resetUserTwoFactor: vi.fn(),
  resendAccountInvitation: vi.fn(),
  inviteStaff: vi.fn(),
}));
vi.mock("../data/audit-trail-repository", () => ({ createAuditTrailRepository: () => repositoryMock }));

import { pendingActionCopy, useAccountAdminViewModel } from "./use-account-admin-view-model";

const marco = { id: "usr_marco", name: "Marco Reyes", email: "marco@pmcm.test", role: "coordinator" } as PrismUser;

describe("account admin confirmations", () => {
  beforeEach(() => {
    Object.values(repositoryMock).forEach((fn) => fn.mockReset().mockResolvedValue(undefined));
  });

  it("changes nothing until the admin confirms, and cancelling leaves the account untouched", async () => {
    const onAccountsChanged = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccountAdminViewModel({ onAccountsChanged }));

    act(() => result.current.requestUnlock(marco));
    expect(result.current.pendingAction).toEqual({ kind: "unlock", user: marco });
    expect(repositoryMock.unlockUser).not.toHaveBeenCalled();

    act(() => result.current.cancelPendingAction());
    expect(result.current.pendingAction).toBeNull();
    expect(repositoryMock.unlockUser).not.toHaveBeenCalled();

    act(() => result.current.requestUnlock(marco));
    await act(async () => { await result.current.confirmPendingAction(); });
    expect(repositoryMock.unlockUser).toHaveBeenCalledTimes(1);
    expect(repositoryMock.unlockUser).toHaveBeenCalledWith("usr_marco");
    expect(result.current.pendingAction).toBeNull();
    expect(result.current.accountFeedback).toMatchObject({ userId: "usr_marco", tone: "success", text: "Account unlocked." });
    expect(onAccountsChanged).toHaveBeenCalledTimes(1);
  });

  it("resets two-factor only after confirmation, and reports a failure on that account", async () => {
    repositoryMock.resetUserTwoFactor.mockRejectedValueOnce(new Error("Not allowed"));
    const { result } = renderHook(() => useAccountAdminViewModel({ onAccountsChanged: vi.fn() }));

    act(() => result.current.requestResetTwoFactor(marco));
    expect(repositoryMock.resetUserTwoFactor).not.toHaveBeenCalled();
    await act(async () => { await result.current.confirmPendingAction(); });

    await waitFor(() => expect(result.current.accountFeedback).toMatchObject({ userId: "usr_marco", tone: "error", text: "Not allowed" }));
    expect(repositoryMock.unlockUser).not.toHaveBeenCalled();
  });

  it("names the account and the consequence in the confirmation", () => {
    expect(pendingActionCopy({ kind: "reset-two-factor", user: marco })).toMatchObject({
      title: "Reset two-factor for Marco Reyes?",
      description: expect.stringContaining("open sessions end"),
    });
  });
});
