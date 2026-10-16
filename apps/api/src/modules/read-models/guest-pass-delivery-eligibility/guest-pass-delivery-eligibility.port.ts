import type { PrismGuestQrPassDeliveryStatus } from '@prism/types';

export interface GuestPassDeliveryEligibilityReader {
  canDeliverGuestPass(passId: string, eventId: string): Promise<boolean>;
}

export interface GuestPassDeliveryStatusReader {
  getGuestPassDeliveryStatuses(
    eventId: string,
    passIds: readonly string[],
  ): Promise<ReadonlyMap<string, PrismGuestQrPassDeliveryStatus>>;
}

export const GUEST_PASS_DELIVERY_ELIGIBILITY_READER = Symbol('GUEST_PASS_DELIVERY_ELIGIBILITY_READER');
export const GUEST_PASS_DELIVERY_STATUS_READER = Symbol('GUEST_PASS_DELIVERY_STATUS_READER');
