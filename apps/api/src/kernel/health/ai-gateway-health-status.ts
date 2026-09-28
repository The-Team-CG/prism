export type AiGatewayHealthStatus = {
  profile: string;
  providerCallsEnabled: boolean;
};

export const AI_GATEWAY_HEALTH_STATUS = Symbol('AI_GATEWAY_HEALTH_STATUS');
