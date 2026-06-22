import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class RequestApprovalDto {
  @IsEmail()
  email!: string;

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