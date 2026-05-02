import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { CanvasObject } from '@prism/shared';

export class CreateTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

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

  @IsArray()
  @IsOptional()
  objects?: CanvasObject[];
}
