import { IsBoolean, IsEmail, IsIn, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

export class SampleActorDto {
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

export class CreateInquiryDto {
  @IsString()
  clientName!: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsEmail()
  email!: string;

  @IsString()
  eventName!: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsISO8601()
  eventDate!: string;

  @IsString()
  clientType!: string;

  @IsOptional()
  @IsIn(['Facebook', 'Website', 'BNI', 'Walk-In', 'Log on Behalf'])
  source?: string;

  @IsOptional()
  @IsString()
  referralDetails?: string;

  @IsOptional()
  @IsString()
  loggedByRole?: string;

  @IsOptional()
  @IsString()
  loggedByName?: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsBoolean()
  privacyConsentAccepted?: boolean;

  @IsOptional()
  @IsString()
  privacyNoticeVersion?: string;

  @IsOptional()
  @IsBoolean()
  marketingConsentAccepted?: boolean;
}

export class UpdateInquiryStatusDto {
  @IsIn(['new', 'accepted', 'pending', 'declined'])
  status!: string;

  @IsOptional()
  @IsIn(['Date Unavailable', 'Outside Service Scope', 'Budget Too Low', 'Prior Issue', 'Other'])
  declineReason?: string;
}

export class UploadConformeDto {
  @IsOptional()
  @IsString()
  type?: string;

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
