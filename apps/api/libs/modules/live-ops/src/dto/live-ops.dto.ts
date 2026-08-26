import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Legacy query compatibility for sample actor fields. Write bodies use the
 * shared Zod contracts from @prism/types.
 */
export class LiveOpsActorDto {
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

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  coordinatorId?: string;
}
