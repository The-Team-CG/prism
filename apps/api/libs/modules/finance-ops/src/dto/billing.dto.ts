import { IsArray, IsEmail, IsIn, IsISO8601, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class BillingActorDto {
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
}

export class CreateBillingSourceDto {
  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsString()
  sourceLabel!: string;

  @IsOptional()
  @IsString()
  sourceDocumentId?: string;

  @IsArray()
  lineItems!: Array<{ label: string; amount: number }>;

  @IsOptional()
  @IsArray()
  paymentSchedule?: Array<{ label: string; percentage: number; dueDate?: string }>;

  @IsOptional()
  @IsArray()
  paymentMethods?: Array<{ label: string; details: string }>;
}

export class ApproveBillingSourceDto {
  @IsOptional()
  @IsString()
  approvedBy?: string;

  @IsOptional()
  @IsString()
  approvalNotes?: string;
}

export class GenerateBillingStatementDto {
  @IsOptional()
  @IsString()
  sourceId?: string;
}

export class MarkPaymentDto {
  @IsIn(['pending', 'paid', 'at_risk'])
  status!: string;
}

export class RecordPaymentDto {
  @IsInt()
  @Min(1)
  amountReceived!: number;

  @IsISO8601()
  paymentDate!: string;

  @IsIn(['Bank Transfer', 'GCash', 'Cheque'])
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;
}
