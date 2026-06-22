import { IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FloorPlanActorDto {
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

export class FloorPlanSnapshotQueryDto extends FloorPlanActorDto {
  @IsOptional()
  @IsIn(['submitted', 'approved'])
  type?: 'submitted' | 'approved';
}

export class CreateFloorPlanDraftDto {
  @IsString()
  name!: string;

  @IsIn(['blank', 'template', 'client_preference'])
  sourceType!: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  gridSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pax?: number;

  @IsOptional()
  @IsArray()
  objects?: unknown[];

  @IsOptional()
  @IsArray()
  guests?: unknown[];

  @IsOptional()
  @IsArray()
  suppliers?: unknown[];
}

export class CreateFloorPlanPreferenceDto {
  @IsString()
  name!: string;

  @IsString()
  seatingStyle!: string;

  @IsString()
  stagePreference!: string;

  @IsString()
  flowNotes!: string;

  @IsInt()
  @Min(1)
  guestCount!: number;

  @IsArray()
  @IsString({ each: true })
  constraints!: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  gridSize?: number;

  @IsOptional()
  @IsArray()
  objects?: unknown[];
}