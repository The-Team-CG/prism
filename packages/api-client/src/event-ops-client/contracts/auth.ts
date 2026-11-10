import type {
  AcknowledgePrivacyNoticeInput,
  ActivateAccountInput,
  CreateAccountInvitationInput,
  LoginInput,
  PrismAccountActivationReceipt,
  PrismAccountInvitationOutcome,
  PrismApprovalRequest,
  PrismApprovalRequestReceipt,
  PrismAuthResponse,
  PrismAuthenticatedSession,
  PrismCurrentUser,
  PrismIdentityAccountSummary,
  PrismSignInSession,
  PrismTwoFactorSetup,
  PrismTwoFactorQr,
  RequestApprovalInput,
  VerifyTwoFactorInput,
} from "@prism/types";

export interface EventOpsAuthContract {
  auth: {
    login(input: LoginInput): Promise<PrismAuthResponse>;
    requestApproval(input: RequestApprovalInput): Promise<PrismApprovalRequestReceipt>;
    logout(): Promise<void>;
    acknowledgePrivacyNotice(input: AcknowledgePrivacyNoticeInput): Promise<void>;
    me(): Promise<PrismCurrentUser>;
    approvalRequests(): Promise<PrismApprovalRequest[]>;
    approveApprovalRequest(requestId: string): Promise<PrismApprovalRequest>;
    declineApprovalRequest(requestId: string): Promise<PrismApprovalRequest>;
    unlockUser(userId: string): Promise<PrismIdentityAccountSummary>;
    resetUserTwoFactor(userId: string): Promise<PrismIdentityAccountSummary>;
    setupTwoFactor(token: string): Promise<PrismTwoFactorSetup>;
    developmentTwoFactorQr(token: string): Promise<PrismTwoFactorQr>;
    verifyTwoFactor(input: VerifyTwoFactorInput): Promise<PrismSignInSession>;
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
