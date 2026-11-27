import { Body, Controller, Delete, Get, Header, Headers, HttpCode, HttpStatus, InternalServerErrorException, Param, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Request } from 'express';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { AllowPendingPrivacyNotice, ClearSessionCookieInterceptor, EventSessionGuard, SetSessionCookieInterceptor, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import { PublicRateLimit, zodBody } from '@prism/kernel/shared';
import { changeOwnPasswordSchema, confirmOwnPasswordSchema, enableOwnTwoFactorSchema, requestEmailChangeSchema, updateOwnProfileSchema, type ChangeOwnPasswordInput, type ConfirmOwnPasswordInput, type EnableOwnTwoFactorInput, type RequestEmailChangeInput, type UpdateOwnProfileInput } from '@prism/types';
import { acknowledgePrivacyNoticeSchema, activateAccountSchema, consumePasswordResetSchema, createAccountInvitationSchema, loginSchema, requestApprovalSchema, requestPasswordResetSchema, twoFactorTokenSchema, verifyTwoFactorSchema, type AcknowledgePrivacyNoticeInput, type ActivateAccountInput, type ConsumePasswordResetInput, type CreateAccountInvitationInput, type LoginInput, type RequestApprovalInput, type RequestPasswordResetInput, type TwoFactorTokenInput, type VerifyTwoFactorInput } from '@prism/types';
import { AuthOperationsService } from '../../application/auth/auth-operations.service';
import { PasswordResetService } from '../../application/auth/password-reset.service';
import { AccountActivationService } from '../../application/auth/account-activation.service';
import { AccountInvitationService } from '../../application/auth/account-invitation.service';
import { OwnSessionsService } from '../../application/auth/own-sessions.service';
import { OwnTwoFactorService } from '../../application/auth/own-two-factor.service';
import { EmailChangeService } from '../../application/auth/email-change.service';
import { EmailSignInService } from '../../application/auth/email-sign-in.service';
import { invitationTokenSchema, requestEmailSignInCodeSchema, verifyEmailSignInCodeSchema, type InvitationTokenInput, type RequestEmailSignInCodeInput, type VerifyEmailSignInCodeInput } from '@prism/types';

@Controller('auth')
export class OpsAuthController {
  constructor(
    private readonly authOperationsService: AuthOperationsService,
    private readonly access: EventAccessPolicyService,
    private readonly passwordResetService: PasswordResetService,
    private readonly accountActivationService: AccountActivationService,
    private readonly accountInvitationService: AccountInvitationService,
    private readonly ownSessions: OwnSessionsService,
    private readonly ownTwoFactor: OwnTwoFactorService,
    private readonly emailChange: EmailChangeService,
    private readonly emailSignIn: EmailSignInService,
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
  @UseInterceptors(SetSessionCookieInterceptor)
  @PublicRateLimit('authentication')
  @HttpCode(HttpStatus.OK)
  login(@Body(zodBody(loginSchema)) dto: LoginInput, @Headers('user-agent') userAgent?: string) {
    return this.authOperationsService.login(dto.email, dto.password, userAgent, dto.trustedDeviceToken);
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

  /** Sign-in redesign: a client or supplier asks for a six-digit code by email instead of typing a password. */
  @Post('email-code/request')
  @PublicRateLimit('accountRequest')
  @HttpCode(HttpStatus.ACCEPTED)
  requestEmailSignInCode(@Req() request: Request, @Body(zodBody(requestEmailSignInCodeSchema)) dto: RequestEmailSignInCodeInput) {
    const clientIp = request.ip;
    if (!clientIp) throw new InternalServerErrorException('Client address is unavailable for sign-in code rate limiting');
    return this.emailSignIn.request(dto.email, clientIp);
  }

  /** Answers like a password sign-in: a session, or the authenticator step for an account that turned it on. */
  @Post('email-code/verify')
  @UseInterceptors(SetSessionCookieInterceptor)
  @PublicRateLimit('authentication')
  @HttpCode(HttpStatus.OK)
  verifyEmailSignInCode(@Body(zodBody(verifyEmailSignInCodeSchema)) dto: VerifyEmailSignInCodeInput, @Headers('user-agent') userAgent?: string) {
    return this.emailSignIn.verify(dto.email, dto.code, userAgent);
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

  /** Who an invitation link is for, so the first-visit page can greet them; does not use the link up. */
  @Post('activate/preview')
  @PublicRateLimit('authentication')
  @HttpCode(HttpStatus.OK)
  previewInvitation(@Body(zodBody(invitationTokenSchema)) dto: InvitationTokenInput) {
    return this.accountActivationService.preview(dto.token);
  }

  /** A client or supplier confirms their invitation and is signed straight in, without setting a password. */
  @Post('activate/confirm')
  @UseInterceptors(SetSessionCookieInterceptor)
  @PublicRateLimit('authentication')
  @HttpCode(HttpStatus.OK)
  async confirmInvitation(@Body(zodBody(invitationTokenSchema)) dto: InvitationTokenInput, @Headers('user-agent') userAgent?: string) {
    const { userId } = await this.accountActivationService.confirm(dto.token);
    return this.authOperationsService.signInWithVerifiedEmail(userId, userAgent);
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
  @UseInterceptors(SetSessionCookieInterceptor)
  @PublicRateLimit('authentication')
  @HttpCode(HttpStatus.OK)
  verifyTwoFactor(@Body(zodBody(verifyTwoFactorSchema)) dto: VerifyTwoFactorInput, @Headers('user-agent') userAgent?: string) {
    return this.authOperationsService.verifyTwoFactor(dto.token, dto.code, userAgent, dto.trustDevice ?? false);
  }

  @Post('2fa/development-qr')
  @PublicRateLimit('authentication')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  developmentTwoFactorQr(@Body(zodBody(twoFactorTokenSchema)) dto: TwoFactorTokenInput) {
    return this.authOperationsService.getDevelopmentTwoFactorQr(dto.token);
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
  @UseInterceptors(ClearSessionCookieInterceptor)
  @UseGuards(EventSessionGuard)
  @AllowPendingPrivacyNotice()
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.authOperationsService.logout(actor);
  }

  @Get('me')
  @UseGuards(EventSessionGuard)
  @AllowPendingPrivacyNotice()
  me(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.authOperationsService.currentUser(actor);
  }

  /** The signed-in person changes their own name. */
  @Patch('me')
  @UseGuards(EventSessionGuard)
  updateMe(@Body(zodBody(updateOwnProfileSchema)) dto: UpdateOwnProfileInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.authOperationsService.updateOwnProfile(actor, dto);
  }

  /** The signed-in person changes their own password; every session ends, so they sign in again with it. */
  @Post('me/password')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  changeMyPassword(@Body(zodBody(changeOwnPasswordSchema)) dto: ChangeOwnPasswordInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.authOperationsService.changeOwnPassword(actor, dto);
  }

  /** The signed-in person's own latest sign-ins. */
  @Get('me/sign-ins')
  @UseGuards(EventSessionGuard)
  mySignIns(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.authOperationsService.listOwnSignIns(actor);
  }

  /** Asks to change the sign-in email: a link goes to the new address, and the change waits for it. */
  @Post('me/email')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  requestEmailChange(@Body(zodBody(requestEmailChangeSchema)) dto: RequestEmailChangeInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.emailChange.request(actor, dto);
  }

  /** Withdraws an email change that is still waiting for its link. */
  @Delete('me/email')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelEmailChange(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.emailChange.cancel(actor);
  }

  /** Starts adding an authenticator app; two-step sign-in stays off until a code from it is confirmed. */
  @Post('me/two-factor/setup')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  startMyTwoFactor(@Body(zodBody(confirmOwnPasswordSchema)) dto: ConfirmOwnPasswordInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.ownTwoFactor.start(actor, dto.password);
  }

  /** Turns two-step sign-in on with a code from the authenticator just added. */
  /** Returns the backup codes for a lost phone, shown once. */
  @Post('me/two-factor/enable')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  enableMyTwoFactor(@Body(zodBody(enableOwnTwoFactorSchema)) dto: EnableOwnTwoFactorInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.ownTwoFactor.enable(actor, dto.code);
  }

  /** A fresh set of backup codes with the current password; the old set stops working. */
  @Post('me/two-factor/backup-codes')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  regenerateMyBackupCodes(@Body(zodBody(confirmOwnPasswordSchema)) dto: ConfirmOwnPasswordInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.ownTwoFactor.regenerateBackupCodes(actor, dto.password);
  }

  /** Turns two-step sign-in off; PMCM staff keep it. */
  @Post('me/two-factor/disable')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  disableMyTwoFactor(@Body(zodBody(confirmOwnPasswordSchema)) dto: ConfirmOwnPasswordInput, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.ownTwoFactor.disable(actor, dto.password);
  }

  /** The browsers the signed-in person is signed in on now. */
  @Get('me/sessions')
  @UseGuards(EventSessionGuard)
  mySessions(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.ownSessions.list(actor);
  }

  /** Signs out every browser but this one. */
  @Post('me/sessions/sign-out-others')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  signOutOtherSessions(@VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.ownSessions.signOutOthers(actor);
  }

  /** Signs out one other browser. */
  @Delete('me/sessions/:sessionId')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  signOutSession(@Param('sessionId') sessionId: string, @VerifiedEventActor() actor: PrismVerifiedEventActor) {
    return this.ownSessions.signOut(actor, sessionId);
  }

  @Post('privacy-notice/acknowledge')
  @UseGuards(EventSessionGuard)
  @AllowPendingPrivacyNotice()
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
