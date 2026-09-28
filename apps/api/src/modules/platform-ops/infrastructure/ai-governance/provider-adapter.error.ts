import type { AiFailureCode } from '@prism/types';

export type ProviderAdapterErrorDetails = {
  status?: number;
  requestId?: string;
};

/** A safe, normalized failure from a provider transport or provider response. */
export class ProviderAdapterError extends Error {
  constructor(
    readonly code: AiFailureCode,
    message: string,
    readonly retryable: boolean,
    readonly details: ProviderAdapterErrorDetails = {},
  ) {
    super(message);
    this.name = 'ProviderAdapterError';
  }
}
