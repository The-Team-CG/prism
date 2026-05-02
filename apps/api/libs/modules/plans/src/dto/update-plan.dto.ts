import { IsArray, IsNumber, IsOptional, IsPositive } from 'class-validator';
import type { CanvasObject, Seat, SeatCategory } from '@prism/shared';

export class UpdatePlanDto {
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

  @IsArray()
  @IsOptional()
  objects?: CanvasObject[];

  @IsArray()
  @IsOptional()
  seats?: Seat[];

  @IsArray()
  @IsOptional()
  seatCategories?: SeatCategory[];
}
