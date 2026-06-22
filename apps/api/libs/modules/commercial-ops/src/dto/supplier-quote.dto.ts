import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SubmitSupplierQuoteDto {
  @IsInt()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inclusions?: string[];

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
