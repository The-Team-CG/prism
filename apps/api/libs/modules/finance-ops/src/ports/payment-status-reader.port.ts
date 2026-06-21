export interface PaymentStatusReader {
  getPaymentStatusForEvent(eventId: string): Promise<unknown>;
}
