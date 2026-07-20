import { describe, expect, it } from 'vitest';
import { DataSanitizerService } from './data-sanitizer.service';

describe('DataSanitizerService', () => {
  it('redacts supplier and company names in nested PARE payloads', () => {
    const sanitizer = new DataSanitizerService();

    const result = sanitizer.sanitize({
      withdrawnSupplier: { supplierName: 'SonicLine Technicals', company_name: 'SonicLine Holdings' },
      candidates: [{ supplier_name: 'AV Backup Crew', companyName: 'Backup Events Inc.' }],
    });

    expect(result.data).toMatchObject({
      withdrawnSupplier: { supplierName: 'S. [SURNAME]', company_name: 'S. [SURNAME]' },
      candidates: [{ supplier_name: 'A. [SURNAME]', companyName: 'B. [SURNAME]' }],
    });
    expect(result.dataCategories).toContain('name');
    expect(JSON.stringify(result.data)).not.toContain('SonicLine');
    expect(JSON.stringify(result.data)).not.toContain('Backup Events');
  });
});
