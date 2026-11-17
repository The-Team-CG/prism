import type {
  ChangeOwnPasswordInput,
  PrismOwnSignIn,
  UpdateOwnProfileInput,
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
    /** Changes the signed-in person's own name. */
    updateMe(input: UpdateOwnProfileInput): Promise<PrismCurrentUser>;
    /** Changes the signed-in person's own password; every session ends. */
    changeMyPassword(input: ChangeOwnPasswordInput): Promise<void>;
    /** The signed-in person's own latest sign-ins. */
    mySignIns(): Promise<PrismOwnSignIn[]>;
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
