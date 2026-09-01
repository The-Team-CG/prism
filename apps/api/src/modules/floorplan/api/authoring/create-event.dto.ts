import { IsISO8601, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateEventDto {
  @IsUUID()
  templateId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsISO8601()
  startsAt!: string;
}
