import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import { zodBody } from '@prism/kernel/shared';
import { consumePasswordResetSchema, loginSchema, requestApprovalSchema, requestPasswordResetSchema, twoFactorTokenSchema, verifyTwoFactorSchema, type ConsumePasswordResetInput, type LoginInput, type RequestApprovalInput, type RequestPasswordResetInput, type TwoFactorTokenInput, type VerifyTwoFactorInput } from '@prism/types';
import { AuthOperationsService } from '../../application/auth/auth-operations.service';
import { PasswordResetService } from '../../application/auth/password-reset.service';

@Controller('auth')
export class OpsAuthController {
  constructor(private readonly authOperationsService: AuthOperationsService, private readonly access: EventAccessPolicyService, private readonly passwordResetService?: PasswordResetService) {}

  private requireAdmin(actor: PrismVerifiedEventActor) {
    return this.access.requireActorRole(this.access.resolveActor({}, actor), [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'identity administration');
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(zodBody(loginSchema)) dto: LoginInput) {
    return this.authOperationsService.login(dto.email, dto.password);
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  requestPasswordReset(@Body(zodBody(requestPasswordResetSchema)) dto: RequestPasswordResetInput) {
    return this.passwordResetService!.request(dto.email);
  }

  @Post('password-reset/consume')
  @HttpCode(HttpStatus.OK)
  consumePasswordReset(@Body(zodBody(consumePasswordResetSchema)) dto: ConsumePasswordResetInput) {
    return this.passwordResetService!.consume(dto.token, dto.password);
  }

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  setupTwoFactor(@Body(zodBody(twoFactorTokenSchema)) dto: TwoFactorTokenInput) {
    return this.authOperationsService.setupTwoFactor(dto.token);
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  verifyTwoFactor(@Body(zodBody(verifyTwoFactorSchema)) dto: VerifyTwoFactorInput) {
    return this.authOperationsService.verifyTwoFactor(dto.token, dto.code);
  }

  @Post('approval-requests')
  @HttpCode(HttpStatus.CREATED)
  requestApproval(@Body(zodBody(requestApprovalSchema)) dto: RequestApprovalInput) {
    return this.authOperationsService.requestApproval(dto);
  }

  @Get('approval-requests')
  @UseGuards(EventSessionGuard)
  listApprovalRequests(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.requireAdmin(actor).then(() => this.authOperationsService.listApprovalRequests());
  }

  @Get('users/:userId/login-history')
  @UseGuards(EventSessionGuard)
  listLoginHistory(@Param('userId') userId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.requireAdmin(actor).then(() => this.authOperationsService.listLoginHistory(userId));
  }

  @Patch('approval-requests/:requestId/approve')
  @UseGuards(EventSessionGuard)
  approveApprovalRequest(@Param('requestId') requestId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.requireAdmin(actor).then(() => this.authOperationsService.approveApprovalRequest(requestId));
  }

  @Patch('approval-requests/:requestId/decline')
  @UseGuards(EventSessionGuard)
  declineApprovalRequest(@Param('requestId') requestId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.requireAdmin(actor).then(() => this.authOperationsService.declineApprovalRequest(requestId));
  }
}
