import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { zodBody } from '@prism/kernel/shared';
import { loginSchema, requestApprovalSchema, twoFactorTokenSchema, verifyTwoFactorSchema, type LoginInput, type RequestApprovalInput, type TwoFactorTokenInput, type VerifyTwoFactorInput } from '@prism/types';
import { AuthOperationsService } from '../../application/auth/auth-operations.service';

@Controller('auth')
export class OpsAuthController {
  constructor(private readonly authOperationsService: AuthOperationsService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body(zodBody(loginSchema)) dto: LoginInput) {
    return this.authOperationsService.login(dto.email, dto.password);
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
  listApprovalRequests() {
    return this.authOperationsService.listApprovalRequests();
  }

  @Get('users/:userId/login-history')
  listLoginHistory(@Param('userId') userId: string) {
    return this.authOperationsService.listLoginHistory(userId);
  }

  @Patch('approval-requests/:requestId/approve')
  approveApprovalRequest(@Param('requestId') requestId: string) {
    return this.authOperationsService.approveApprovalRequest(requestId);
  }

  @Patch('approval-requests/:requestId/decline')
  declineApprovalRequest(@Param('requestId') requestId: string) {
    return this.authOperationsService.declineApprovalRequest(requestId);
  }
}
