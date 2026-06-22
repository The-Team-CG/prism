import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class ComplianceActorDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsIn(['pmcm-admin', 'client', 'supplier', 'coordinator', 'guest', 'system', 'unknown'])
  actorRole?: string;

  @IsOptional()
  @IsString()
  actorEmail?: string;

  @IsOptional()
  @IsString()
  actorName?: string;
}

export class CreateComplianceRuleDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  phase?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  layer?: string;

  @IsString()
  conditionKey!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateComplianceRuleDto extends CreateComplianceRuleDto {}

export class RunComplianceDto {
  @IsOptional()
  @IsString()
  phase?: string;
}

export class ResolveComplianceDto {
  @IsOptional()
  @IsIn(['resolve', 'override'])
  action?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  overrideReason?: string;

  @IsOptional()
  @IsString()
  actorName?: string;
}
