export interface BillingReader {
  getBillingForEvent(eventId: string): Promise<unknown>;
}
