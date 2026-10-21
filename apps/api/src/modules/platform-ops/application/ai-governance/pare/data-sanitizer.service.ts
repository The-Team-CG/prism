export type SanitizedPayload = {
  data: Record<string, unknown>;
  dataCategories: string[];
};

export class DataSanitizerService {
  sanitize(raw: Record<string, unknown>): SanitizedPayload {
    const categories: string[] = [];
    const data = this.sanitizeValue(raw, categories) as Record<string, unknown>;
    return { data, dataCategories: [...new Set(categories)] };
  }

  private sanitizeValue(value: unknown, categories: string[]): unknown {
    if (Array.isArray(value)) {
      return value.map((v) => this.sanitizeValue(v, categories));
    }
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [
          k,
          this.sanitizeField(k, v, categories),
        ]),
      );
    }
    return value;
  }

  private sanitizeField(key: string, value: unknown, categories: string[]): unknown {
    const lk = key.toLowerCase();

    if (this.isEmailField(lk)) {
      categories.push('email');
      return '[EMAIL]';
    }
    if (this.isPhoneField(lk)) {
      categories.push('phone');
      return '[PHONE]';
    }
    if (this.isNameField(lk)) {
      categories.push('name');
      return this.anonymizeName(String(value ?? ''));
    }

    if (value !== null && typeof value === 'object') {
      return this.sanitizeValue(value, categories);
    }
    return value;
  }

  private isEmailField(key: string) {
    return key.includes('email');
  }

  private isPhoneField(key: string) {
    return key.includes('phone') || key.includes('mobile') || key.includes('contact');
  }

  private isNameField(key: string) {
    return (
      key === 'clientname' ||
      key === 'contactname' ||
      key === 'clientcontact' ||
      key === 'guestname' ||
      key === 'suppliername' ||
      key === 'supplier_name' ||
      key === 'companyname' ||
      key === 'company_name' ||
      key === 'name'
    );
  }

  private anonymizeName(value: string): string {
    if (!value) return '[NAME]';
    const parts = value.trim().split(/\s+/);
    return parts.length > 1
      ? `${parts[0][0]}. [SURNAME]`
      : `${value[0]}. [NAME]`;
  }
}
