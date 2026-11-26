import type {
  ChangeOwnPasswordInput,
  PrismOwnSignIn,
  PrismOwnSession,
  PrismOwnSessionsSignedOut,
  PrismOwnTwoFactorSetup,
  PrismEmailChangeConfirmed,
  PrismPendingEmailChange,
  RequestEmailChangeInput,
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
  VerifyEmailSignInCodeInput,
  PrismInvitationPreview,
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
    /** Asks to change the sign-in email; a link goes to the new address and the change waits for it. */
    requestEmailChange(input: RequestEmailChangeInput): Promise<PrismPendingEmailChange>;
    /** Withdraws the email change still waiting for its link. */
    cancelEmailChange(): Promise<void>;
    /** Opens the link from the confirmation email; needs no session. */
    confirmEmailChange(token: string): Promise<PrismEmailChangeConfirmed>;
    /** Starts adding an authenticator app with the current password; two-step sign-in stays off until confirmed. */
    startMyTwoFactor(password: string): Promise<PrismOwnTwoFactorSetup>;
    /** Turns two-step sign-in on with a code from the app just added. */
    enableMyTwoFactor(code: string): Promise<void>;
    /** Turns two-step sign-in off with the current password. */
    disableMyTwoFactor(password: string): Promise<void>;
    /** The browsers the signed-in person is signed in on now, this one first. */
    mySessions(): Promise<PrismOwnSession[]>;
    /** Signs out one other browser. */
    signOutSession(sessionId: string): Promise<void>;
    /** Signs out every browser but this one. */
    signOutOtherSessions(): Promise<PrismOwnSessionsSignedOut>;
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
    /** Emails a client or supplier a six-digit sign-in code; answers the same whether or not the email exists. */
    requestEmailSignInCode(email: string): Promise<{ message: string }>;
    /** Who an invitation link is for; does not use the link up. */
    previewInvitation(token: string): Promise<PrismInvitationPreview>;
    /** A client or supplier confirms their invitation and is signed in, without a password. */
    confirmInvitation(token: string): Promise<PrismAuthResponse>;
    /** A session, or the authenticator step for an account that turned two-step sign-in on. */
    verifyEmailSignInCode(input: VerifyEmailSignInCodeInput): Promise<PrismAuthResponse>;
    consumePasswordReset(
      token: string,
      password: string,
    ): Promise<{ message: string }>;
    activateAccount(input: ActivateAccountInput): Promise<PrismAccountActivationReceipt>;
    inviteStaff(input: CreateAccountInvitationInput): Promise<PrismAccountInvitationOutcome>;
    resendAccountInvitation(userId: string): Promise<PrismAccountInvitationOutcome>;
  };
}
