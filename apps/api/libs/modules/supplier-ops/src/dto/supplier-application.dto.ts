import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateSupplierApplicationDto {
  @IsString()
  companyName!: string;

  @IsString()
  contactName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  pastEvents?: string;

  @IsOptional()
  @IsString()
  serviceInclusions?: string;

  @IsOptional()
  @IsString()
  certifications?: string;

  @IsOptional()
  @IsString()
  priceRange?: string;

  @IsOptional()
  @IsBoolean()
  bniMember?: boolean;

  @IsOptional()
  @IsString()
  portfolioUrl?: string;

  @IsOptional()
  @IsString()
  additionalNotes?: string;

  @IsOptional()
  @IsBoolean()
  privacyConsentAccepted?: boolean;

  @IsOptional()
  @IsString()
  privacyNoticeVersion?: string;
}
