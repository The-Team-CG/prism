import { IsBoolean, IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

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

export class CreateCoordinatorAssignmentDto {
  @IsOptional()
  @IsString()
  coordinatorId?: string;

  @IsOptional()
  @IsString()
  coordinatorName?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  overrideConflict?: boolean;
}

export class WithdrawCoordinatorAssignmentDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReplaceCoordinatorAssignmentDto {
  @IsOptional()
  @IsString()
  replacementCoordinatorId?: string;

  @IsOptional()
  @IsString()
  replacementCoordinatorName?: string;

  @IsOptional()
  @IsString()
  replacementRole?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  overrideConflict?: boolean;
}
