import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SupplierActorDto {
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
}

export class CreateSupplierDto {
  @IsString()
  categoryId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  tier?: string;

  @IsOptional()
  @IsBoolean()
  bniMember?: boolean;

  @IsOptional()
  @IsString()
  serviceInclusions?: string;

  @IsOptional()
  @IsString()
  performanceNotes?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  bniMember?: boolean;

  @IsOptional()
  @IsString()
  serviceInclusions?: string;

  @IsOptional()
  @IsString()
  performanceNotes?: string;
}

export class ChangeSupplierTierDto {
  @IsString()
  tier!: string;

  @IsString()
  reason!: string;
}

export class CreateSupplierReviewDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsInt()
  @Min(1)
  rating!: number;

  @IsString()
  notes!: string;

  @IsOptional()
  @IsString()
  reviewedBy?: string;
}

export class CreateSupplierCertificationDto {
  @IsString()
  fileName!: string;

  @IsString()
  documentType!: string;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}