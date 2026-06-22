import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class GuestUploadMetadataDto {
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

export class GuestCheckInDto {
  @IsString()
  guestName!: string;

  @IsOptional()
  @IsIn(['name_search', 'walk_in'])
  checkInMode?: string;

  @IsOptional()
  @IsBoolean()
  walkIn?: boolean;

  @IsOptional()
  @IsIn(['verified', 'flagged'])
  verificationStatus?: string;

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

export class GuestFeedbackDto {
  @IsString()
  guestName!: string;

  @IsInt()
  @Min(1)
  rating!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsObject()
  photo?: GuestUploadMetadataDto;

  @IsOptional()
  @IsObject()
  video?: GuestUploadMetadataDto;

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