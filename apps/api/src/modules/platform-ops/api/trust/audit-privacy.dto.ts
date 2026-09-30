import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class ActorContextDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsIn(['pmcm-admin', 'client', 'supplier', 'coordinator', 'guest', 'system', 'unknown'])
  actorRole?: string;

  @IsOptional()
  @IsEmail()
  actorEmail?: string;

  @IsOptional()
  @IsString()
  actorName?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  coordinatorId?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  accessCode?: string;
}

export class ListAuditLogsDto extends ActorContextDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  actor?: string;

  @IsOptional()
  @IsString()
  actionType?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  dateRange?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}

export class ExportAuditLogsDto extends ListAuditLogsDto {}

export class CreatePrivacyRequestDto {
  @IsString()
  subjectType!: string;

  @IsOptional()
  @IsEmail()
  subjectEmail?: string;

  @IsOptional()
  @IsString()
  subjectName?: string;

  @IsOptional()
  @IsString()
  eventId?: string;

  @IsIn(['access', 'correction', 'deletion', 'export'])
  requestType!: string;

  @IsOptional()
  @IsString()
  requestNotes?: string;
}

export class ReviewPrivacyRequestDto {
  @IsIn(['approved', 'rejected'])
  status!: string;

  @IsOptional()
  @IsString()
  reviewReason?: string;
}

export class ExecutePrivacyRequestDto {
  @IsOptional()
  @IsString()
  executionNotes?: string;
}
