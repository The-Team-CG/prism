import type { PrismGuestEventPass } from "@prism/types";
import { guestEventInfoRepository } from "../data/guest-event-info-repository";
import {
  buildEventInfoQrUrl,
  buildEventInfoRows,
} from "../model/guest-event-info-rules";
import type { GuestEventInfoRow } from "../model/guest-event-info-types";

export async function loadGuestEventInfo(accessCodeParam: string): Promise<{
  event: PrismGuestEventPass;
  infoRows: GuestEventInfoRow[];
  qrUrl: string;
}> {
  const event = await guestEventInfoRepository.fetchEvent(accessCodeParam);
  const guestBaseUrl = process.env.NEXT_PUBLIC_GUEST_URL ?? "http://localhost:3003";
  return {
    event,
    infoRows: buildEventInfoRows(event),
    qrUrl: buildEventInfoQrUrl(guestBaseUrl, event.guestAccessCode),
  };
}
