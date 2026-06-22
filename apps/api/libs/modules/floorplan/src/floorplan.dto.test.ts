import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { FloorPlanSnapshotQueryDto } from './dto/floorplan.dto';

describe('floorplan DTO validation', () => {
  it('allows floorplan snapshot type alongside client actor query fields', async () => {
    const query = plainToInstance(FloorPlanSnapshotQueryDto, {
      type: 'approved',
      actorRole: 'client',
      actorName: 'Ana Reyes',
      actorEmail: 'ana@ayala.test',
    });

    const errors = await validate(query, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors).toHaveLength(0);
  });
});
