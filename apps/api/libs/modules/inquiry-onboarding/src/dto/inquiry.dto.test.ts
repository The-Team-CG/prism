import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UploadConformeDto } from './inquiry.dto';

describe('UploadConformeDto', () => {
  it('rejects a fileName without a .pdf extension', async () => {
    const dto = plainToInstance(UploadConformeDto, { fileName: 'malware.exe' });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'fileName')).toBe(true);
  });

  it('accepts a valid .pdf fileName regardless of what mimeType is supplied', async () => {
    const cases = [
      { fileName: 'signed-conforme.pdf' },
      { fileName: 'signed-conforme.pdf', mimeType: '' },
      { fileName: 'signed-conforme.pdf', mimeType: 'application/octet-stream' },
      { fileName: 'signed-conforme.PDF', mimeType: 'application/pdf' },
    ];

    for (const input of cases) {
      const dto = plainToInstance(UploadConformeDto, input);
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });
});
