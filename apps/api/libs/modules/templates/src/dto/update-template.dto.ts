import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import type { CanvasObject } from '@prism/shared';

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(400)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  venueRules?: string;

  @IsArray()
  @IsOptional()
  permanentFeatures?: CanvasObject[];
}
