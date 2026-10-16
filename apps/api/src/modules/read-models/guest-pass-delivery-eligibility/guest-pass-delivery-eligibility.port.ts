export interface GuestPassDeliveryEligibilityReader {
  canDeliverGuestPass(passId: string, eventId: string): Promise<boolean>;
}

export const GUEST_PASS_DELIVERY_ELIGIBILITY_READER = Symbol('GUEST_PASS_DELIVERY_ELIGIBILITY_READER');
