import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { confirmEmailChangeSchema, type ConfirmEmailChangeInput } from '@prism/types';
import { PublicRateLimit, zodBody } from '@prism/kernel/shared';
import { AccountEmailChangeService } from './account-email-change.service';

/** The link in the confirmation email. Public: it may be opened on a device that is not signed in. */
@Controller('auth')
export class AccountEmailChangeController {
  constructor(private readonly emailChange: AccountEmailChangeService) {}

  @Post('email-change/confirm')
  @PublicRateLimit('authentication')
  @HttpCode(HttpStatus.OK)
  confirm(@Body(zodBody(confirmEmailChangeSchema)) dto: ConfirmEmailChangeInput) {
    return this.emailChange.confirm(dto.token);
  }
}
