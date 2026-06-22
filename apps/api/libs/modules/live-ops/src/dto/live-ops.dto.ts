import { IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class UploadMetadataDto {
  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}
export class LiveOpsActorDto {
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
  supplierId?: string;

  @IsOptional()
  @IsString()
  coordinatorId?: string;
}

export class CreateEventDayTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  assignedRole?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  slaDueAt?: string;
}

export class UpdateEventDayTaskDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  slaDueAt?: string;
}

export class CreateUrgentIssueDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  openedBy?: string;

  @IsOptional()
  @IsString()
  slaDueAt?: string;
}

export class UpdateUrgentIssueDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString()
  slaDueAt?: string;
}

export class EscalateLiveOpsRecordDto {
  @IsOptional()
  @IsString()
  escalationLevel?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;
}

export class UpdateCoordinatorAttendanceDto {
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  markedBy?: string;
}

export class ReplaceCoordinatorAssignmentDto {
  @IsString()
  replacementCoordinatorId!: string;

  @IsString()
  role!: string;

  @IsString()
  reason!: string;
}

export class SupplierEventStatusDto {
  @IsIn(['arrived', 'set_up_ready', 'done_leaving'])
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  photo?: UploadMetadataDto;
}

export class VerifySupplierStatusDto {
  @IsIn(['verified', 'disputed'])
  verificationStatus!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
