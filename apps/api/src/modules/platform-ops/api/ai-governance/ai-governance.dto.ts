import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class AiGovernanceDryRunDto {
  @IsOptional()
  @IsString()
  eventId?: string;

  @IsString()
  featureName!: string;

  @IsString()
  modelVersion!: string;

  @IsBoolean()
  zdrConfirmed!: boolean;

  @IsObject()
  payload!: Record<string, unknown>;
}
