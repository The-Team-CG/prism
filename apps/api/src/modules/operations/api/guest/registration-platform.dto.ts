import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RegistrationPlatformActorDto {
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

export class CreateRegistrationPlatformDto {
  @IsIn(['xperto', 'clickpass', 'custom', 'none'])
  platformType!: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedPaxMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedPaxMax?: number;

  @IsOptional()
  @IsString()
  setupNotes?: string;
}

export class UpdateRegistrationPlatformDto {
  @IsOptional()
  @IsIn(['xperto', 'clickpass', 'custom', 'none'])
  platformType?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedPaxMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedPaxMax?: number;

  @IsOptional()
  @IsIn(['not_started', 'configuring', 'live', 'closed'])
  status?: string;

  @IsOptional()
  @IsString()
  setupNotes?: string;
}

export class ImportHeadcountDto {
  @IsString()
  headcountSource!: string;

  @IsInt()
  @Min(0)
  importedHeadcount!: number;

  @IsOptional()
  @IsString()
  importedFileName?: string;
}
