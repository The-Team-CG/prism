import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { LoginDto, RequestApprovalDto } from '../dto/auth.dto';
import { AuthOperationsService } from '../services/auth-operations.service';

@Controller('auth')
export class OpsAuthController {
  constructor(private readonly authOperationsService: AuthOperationsService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authOperationsService.login(dto.email, dto.password);
  }

  @Post('approval-requests')
  @HttpCode(HttpStatus.CREATED)
  requestApproval(@Body() dto: RequestApprovalDto) {
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