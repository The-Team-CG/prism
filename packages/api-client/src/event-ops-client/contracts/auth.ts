import type {
  LoginInput,
  PrismApprovalRequest,
  PrismAuthResponse,
  PrismAuthenticatedSession,
  PrismTwoFactorSetup,
  RequestApprovalInput,
  VerifyTwoFactorInput,
} from "@prism/types";

export interface EventOpsAuthContract {
  auth: {
    login(input: LoginInput): Promise<PrismAuthResponse>;
    requestApproval(input: RequestApprovalInput): Promise<PrismApprovalRequest>;
    setupTwoFactor(token: string): Promise<PrismTwoFactorSetup>;
    verifyTwoFactor(input: VerifyTwoFactorInput): Promise<PrismAuthenticatedSession>;
    requestPasswordReset(
      email: string,
    ): Promise<{ message: string; deliveryAvailable: boolean }>;
    consumePasswordReset(
      token: string,
      password: string,
    ): Promise<{ message: string }>;
  };
}
