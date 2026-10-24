import type {
  ActivateAccountInput,
  CreateAccountInvitationInput,
  LoginInput,
  PrismAccountActivationReceipt,
  PrismAccountInvitationOutcome,
  PrismApprovalRequestReceipt,
  PrismAuthResponse,
  PrismAuthenticatedSession,
  PrismCurrentUser,
  PrismIdentityAccountSummary,
  PrismTwoFactorSetup,
  RequestApprovalInput,
  VerifyTwoFactorInput,
} from "@prism/types";

export interface EventOpsAuthContract {
  auth: {
    login(input: LoginInput): Promise<PrismAuthResponse>;
    requestApproval(input: RequestApprovalInput): Promise<PrismApprovalRequestReceipt>;
    logout(): Promise<void>;
    me(): Promise<PrismCurrentUser>;
    unlockUser(userId: string): Promise<PrismIdentityAccountSummary>;
    resetUserTwoFactor(userId: string): Promise<PrismIdentityAccountSummary>;
    setupTwoFactor(token: string): Promise<PrismTwoFactorSetup>;
    verifyTwoFactor(input: VerifyTwoFactorInput): Promise<PrismAuthenticatedSession>;
    requestPasswordReset(
      email: string,
    ): Promise<{ message: string }>;
    consumePasswordReset(
      token: string,
      password: string,
    ): Promise<{ message: string }>;
    activateAccount(input: ActivateAccountInput): Promise<PrismAccountActivationReceipt>;
    inviteStaff(input: CreateAccountInvitationInput): Promise<PrismAccountInvitationOutcome>;
    resendAccountInvitation(userId: string): Promise<PrismAccountInvitationOutcome>;
  };
}
