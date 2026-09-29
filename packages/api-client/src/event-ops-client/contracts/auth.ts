export interface EventOpsAuthContract {
  auth: {
    requestPasswordReset(
      email: string,
    ): Promise<{ message: string; deliveryAvailable: boolean }>;
    consumePasswordReset(
      token: string,
      password: string,
    ): Promise<{ message: string }>;
  };
}
