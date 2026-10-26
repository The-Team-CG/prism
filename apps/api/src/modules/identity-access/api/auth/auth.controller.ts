import { Body, Controller, Get, HttpCode, HttpStatus, InternalServerErrorException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import { PublicRateLimit, zodBody } from '@prism/kernel/shared';
import { acknowledgePrivacyNoticeSchema, activateAccountSchema, consumePasswordResetSchema, createAccountInvitationSchema, loginSchema, requestApprovalSchema, requestPasswordResetSchema, twoFactorTokenSchema, verifyTwoFactorSchema, type AcknowledgePrivacyNoticeInput, type ActivateAccountInput, type ConsumePasswordResetInput, type CreateAccountInvitationInput, type LoginInput, type RequestApprovalInput, type RequestPasswordResetInput, type TwoFactorTokenInput, type VerifyTwoFactorInput } from '@prism/types';
import { AuthOperationsService } from '../../application/auth/auth-operations.service';
import { PasswordResetService } from '../../application/auth/password-reset.service';
import { AccountActivationService } from '../../application/auth/account-activation.service';
import { AccountInvitationService } from '../../application/auth/account-invitation.service';

@Controller('auth')
export class OpsAuthController {
  constructor(
    private readonly authOperationsService: AuthOperationsService,
    private readonly access: EventAccessPolicyService,
    private readonly passwordResetService: PasswordResetService,
    private readonly accountActivationService: AccountActivationService,
    private readonly accountInvitationService: AccountInvitationService,
  ) {}

  private async requireAdmin(actor: PrismVerifiedEventActor): Promise<ResolvedEventOpsActor> {
    const resolvedActor = this.access.resolveActor({}, actor);
    await this.access.requireActorRole(resolvedActor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'identity administration');
    return resolvedActor;
  }

  private async requirePmcmAdmin(actor: PrismVerifiedEventActor): Promise<ResolvedEventOpsActor> {
    const resolvedActor = this.access.resolveActor({}, actor);
    await this.access.requireActorRole(resolvedActor, [OpsUserRole.PmcmAdmin], 'account invitations');
    return resolvedActor;
  }

  @Post('login')
  @PublicRateLimit('authentication')
  @HttpCode(HttpStatus.OK)
  login(@Body(zodBody(loginSchema)) dto: LoginInput) {
    return this.authOperationsService.login(dto.email, dto.password);
  }

  @Post('password-reset/request')
  @PublicRateLimit('accountRequest')
  @HttpCode(HttpStatus.ACCEPTED)
  requestPasswordReset(@Req() request: Request, @Body(zodBody(requestPasswordResetSchema)) dto: RequestPasswordResetInput) {
    // Express sets req.ip from the trusted proxy setting (PRISM_TRUST_PROXY is required at startup).
    // Missing means the server is misconfigured; refuse rather than sharing one bucket for everyone.
    const clientIp = request.ip;
    if (!clientIp) throw new InternalServerErrorException('Client address is unavailable for password reset rate limiting');
    return this.passwordResetService.request(dto.email, clientIp);
  }

  @Post('password-reset/consume')
  @PublicRateLimit('authentication')
  @HttpCode(HttpStatus.OK)
  consumePasswordReset(@Body(zodBody(consumePasswordResetSchema)) dto: ConsumePasswordResetInput) {
    return this.passwordResetService.consume(dto.token, dto.password);
  }

  @Post('activate')
  @PublicRateLimit('authentication')
  @HttpCode(HttpStatus.OK)
  activateAccount(@Body(zodBody(activateAccountSchema)) dto: ActivateAccountInput) {
    return this.accountActivationService.activate(dto.token, dto.password);
  }

  @Post('invitations')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  inviteStaff(@Body(zodBody(createAccountInvitationSchema)) dto: CreateAccountInvitationInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.requirePmcmAdmin(actor).then((verifiedActor) => this.accountInvitationService.inviteStaff(dto, verifiedActor));
  }

  @Post('invitations/:userId/resend')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  resendInvitation(@Param('userId') userId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.requirePmcmAdmin(actor).then((verifiedActor) => this.accountInvitationService.resendInvitation(userId, verifiedActor));
  }

  @Post('2fa/setup')
  @PublicRateLimit('authentication')
  @HttpCode(HttpStatus.OK)
  setupTwoFactor(@Body(zodBody(twoFactorTokenSchema)) dto: TwoFactorTokenInput) {
    return this.authOperationsService.setupTwoFactor(dto.token);
  }

  @Post('2fa/verify')
  @PublicRateLimit('authentication')
  @HttpCode(HttpStatus.OK)
  verifyTwoFactor(@Body(zodBody(verifyTwoFactorSchema)) dto: VerifyTwoFactorInput) {
    return this.authOperationsService.verifyTwoFactor(dto.token, dto.code);
  }

  @Post('approval-requests')
  @PublicRateLimit('accountRequest')
  @HttpCode(HttpStatus.ACCEPTED)
  requestApproval(@Body(zodBody(requestApprovalSchema)) dto: RequestApprovalInput) {
    return this.authOperationsService.requestApproval(dto);
  }

  @Get('approval-requests')
  @UseGuards(EventSessionGuard)
  listApprovalRequests(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.requireAdmin(actor).then(() => this.authOperationsService.listApprovalRequests());
  }

  @Post('logout')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.authOperationsService.logout(actor);
  }

  @Get('me')
  @UseGuards(EventSessionGuard)
  me(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.authOperationsService.currentUser(actor);
  }

  @Post('privacy-notice/acknowledge')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  acknowledgePrivacyNotice(@Body(zodBody(acknowledgePrivacyNoticeSchema)) dto: AcknowledgePrivacyNoticeInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.authOperationsService.acknowledgePrivacyNotice(actor, dto.version);
  }

  @Get('users/:userId/login-history')
  @UseGuards(EventSessionGuard)
  listLoginHistory(@Param('userId') userId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.requireAdmin(actor).then(() => this.authOperationsService.listLoginHistory(userId));
  }

  @Patch('users/:userId/unlock')
  @UseGuards(EventSessionGuard)
  unlockUser(@Param('userId') userId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.requireAdmin(actor).then((verifiedActor) => this.authOperationsService.unlockUser(userId, verifiedActor));
  }

  @Patch('users/:userId/two-factor/reset')
  @UseGuards(EventSessionGuard)
  resetUserTwoFactor(@Param('userId') userId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.requireAdmin(actor).then((verifiedActor) => this.authOperationsService.resetUserTwoFactor(userId, verifiedActor));
  }

  @Patch('approval-requests/:requestId/approve')
  @UseGuards(EventSessionGuard)
  approveApprovalRequest(@Param('requestId') requestId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.requireAdmin(actor).then((verifiedActor) => this.authOperationsService.approveApprovalRequest(requestId, verifiedActor));
  }

  @Patch('approval-requests/:requestId/decline')
  @UseGuards(EventSessionGuard)
  declineApprovalRequest(@Param('requestId') requestId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.requireAdmin(actor).then((verifiedActor) => this.authOperationsService.declineApprovalRequest(requestId, verifiedActor));
  }
}
