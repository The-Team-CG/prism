/**
 * ZDR sanitizer for anything PARE stores or hands to a model for audit.
 *
 * Emails and phone numbers become markers; personal and company names are
 * reduced to an initial. `dataCategories` records which classes of personal data
 * were present, so the audit log can state what was seen without retaining it.
 */

export type SanitizedPayload = {
  data: Record<string, unknown>;
  dataCategories: string[];
};

export function sanitizePareData(raw: Record<string, unknown>): SanitizedPayload {
  const categories: string[] = [];
  const data = sanitizeValue(raw, categories) as Record<string, unknown>;
  return { data, dataCategories: [...new Set(categories)] };
}

function sanitizeValue(value: unknown, categories: string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, categories));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeField(key, item, categories),
      ]),
    );
  }
  return value;
}

function sanitizeField(key: string, value: unknown, categories: string[]): unknown {
  const lowerKey = key.toLowerCase();

  if (isEmailField(lowerKey)) {
    categories.push("email");
    return "[EMAIL]";
  }
  if (isPhoneField(lowerKey)) {
    categories.push("phone");
    return "[PHONE]";
  }
  if (isNameField(lowerKey)) {
    categories.push("name");
    return anonymizeName(String(value ?? ""));
  }

  if (value !== null && typeof value === "object") {
    return sanitizeValue(value, categories);
  }
  return value;
}

function isEmailField(key: string): boolean {
  return key.includes("email");
}

function isPhoneField(key: string): boolean {
  return key.includes("phone") || key.includes("mobile") || key.includes("contact");
}

function isNameField(key: string): boolean {
  return (
    key === "clientname" ||
    key === "contactname" ||
    key === "clientcontact" ||
    key === "guestname" ||
    key === "suppliername" ||
    key === "supplier_name" ||
    key === "companyname" ||
    key === "company_name" ||
    key === "name"
  );
}

function anonymizeName(value: string): string {
  if (!value) return "[NAME]";
  const parts = value.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. [SURNAME]` : `${value[0]}. [NAME]`;
}
