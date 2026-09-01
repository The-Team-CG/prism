import { IsArray, IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import type { CanvasObject, Seat, SeatCategory } from '@prism/kernel/shared';

export class UpdatePlanDto {
  @IsString()
  @IsOptional()
  venue?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  width?: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  height?: number;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  gridSize?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  pax?: number;

  @IsArray()
  @IsOptional()
  objects?: CanvasObject[];

  @IsArray()
  @IsOptional()
  guests?: unknown[];

  @IsArray()
  @IsOptional()
  suppliers?: unknown[];

  @IsArray()
  @IsOptional()
  seats?: Seat[];

  @IsArray()
  @IsOptional()
  seatCategories?: SeatCategory[];
}
