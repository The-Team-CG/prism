export interface SupplierReadinessReader {
  getSupplierReadinessForEvent(eventId: string): Promise<unknown>;
}
