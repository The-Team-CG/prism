import { BadGatewayException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import type { AiGatewayRunFailure } from '@prism/types';

/** Maps a gateway failure to a user-safe HTTP error. Provider and route details stay in the audit log. */
export function aiRunFailureToHttpException(failure: AiGatewayRunFailure): HttpException {
  switch (failure.error.code) {
    case 'use_case_disabled':
      return new ServiceUnavailableException('AI drafting is not available: no AI provider is configured.');
    case 'zdr_required':
    case 'synthetic_provenance_required':
      return new ServiceUnavailableException(
        'AI drafting is blocked: the configured provider route is not approved for real event data.',
      );
    case 'invalid_input':
      return new BadGatewayException('The request could not be prepared for AI drafting.');
    case 'invalid_output':
      return new BadGatewayException('The AI returned a response that could not be used. Try again.');
    default:
      return new ServiceUnavailableException(
        failure.error.retryable ? 'AI drafting is temporarily unavailable. Try again shortly.' : 'AI drafting failed.',
      );
  }
}
