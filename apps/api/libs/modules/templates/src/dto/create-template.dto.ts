import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
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
  @MaxLength(160)
  venue?: string;

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

  @IsInt()
  @Min(1)
  @IsOptional()
  width?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  height?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  gridSize?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  pax?: number;

  @IsBoolean()
  @IsOptional()
  includeGuests?: boolean;

  @IsBoolean()
  @IsOptional()
  includeSuppliers?: boolean;

  @IsArray()
  @IsOptional()
  guests?: unknown[];

  @IsArray()
  @IsOptional()
  suppliers?: unknown[];

  @IsString()
  @IsOptional()
  @MaxLength(40)
  sourceType?: string;
}
