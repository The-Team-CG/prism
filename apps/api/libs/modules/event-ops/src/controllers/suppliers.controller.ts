import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  AddSupplierQuoteDto,
  AiGovernanceDryRunDto,
  ApproveBillingSourceDto,
  ArchiveEventDto,
  ChangeSupplierTierDto,
  CreateBillingSourceDto,
  CreateComplianceRuleDto,
  CreateCoordinatorAssignmentDto,
  CreateEventDayTaskDto,
  CreateFloorPlanDraftDto,
  CreateFloorPlanPreferenceDto,
  CreateInquiryDto,
  CreateSupplierCertificationDto,
  CreateSupplierDto,
  CreateSupplierReviewDto,
  CreateUrgentIssueDto,
  CreatePrivacyRequestDto,
  DemoActorDto,
  ExecutePrivacyRequestDto,
  EscalateLiveOpsRecordDto,
  ExportAuditLogsDto,
  FloorPlanSnapshotQueryDto,
  GuestCheckInDto,
  GuestFeedbackDto,
  ListAuditLogsDto,
  LoginDto,
  MarkPaymentDto,
  RecordPaymentDto,
  RequestApprovalDto,
  RequestSupplierQuotesDto,
  ResolveComplianceDto,
  ReplaceCoordinatorAssignmentDto,
  ReviewPrivacyRequestDto,
  SubmitSupplierQuoteDto,
  SubmitBriefingDto,
  SupplierContractUploadDto,
  SupplierEventStatusDto,
  SupplierReadinessDto,
  UpdateCoordinatorAttendanceDto,
  UpdateComplianceRuleDto,
  UpdateEventDayTaskDto,
  UpdateUrgentIssueDto,
  UpdateSupplierDto,
  UpdateInquiryStatusDto,
  UploadConformeDto,
  VerifySupplierStatusDto,
} from '../dto/event-ops.dto';
import { EventOpsService } from '../event-ops.service';

@Controller('suppliers')
export class OpsSuppliersController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get('categories')
  listCategories(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listSupplierCategories(actor);
  }

  @Get()
  list(@Query() actor: DemoActorDto) {
    return this.eventOpsService.listSuppliers(actor);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSupplierDto, @Query() actor: DemoActorDto) {
    return this.eventOpsService.createSupplier(dto, actor);
  }

  @Patch(':supplierId')
  update(@Param('supplierId') supplierId: string, @Body() dto: UpdateSupplierDto, @Query() actor: DemoActorDto) {
    return this.eventOpsService.updateSupplier(supplierId, dto, actor);
  }

  @Patch(':supplierId/tier')
  changeTier(
    @Param('supplierId') supplierId: string,
    @Body() dto: ChangeSupplierTierDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.changeSupplierTier(supplierId, dto, actor);
  }

  @Post(':supplierId/reviews')
  @HttpCode(HttpStatus.CREATED)
  addReview(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierReviewDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.addSupplierReview(supplierId, dto, actor);
  }

  @Post(':supplierId/certifications')
  @HttpCode(HttpStatus.CREATED)
  addCertification(
    @Param('supplierId') supplierId: string,
    @Body() dto: CreateSupplierCertificationDto,
    @Query() actor: DemoActorDto,
  ) {
    return this.eventOpsService.addSupplierCertification(supplierId, dto, actor);
  }
}

