export const ACCOUNT_CONTACT_READ_MODEL = Symbol.for('prism.readModels.accountContact');

/** Read-only contact projection for approved accounts. */
export interface AccountContactReadModel {
  findApprovedEmailByRole(role: string): Promise<string | null>;
  findApprovedEmailByName(name: string): Promise<string | null>;
}
