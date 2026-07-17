import { prismApi } from "@/lib/prism-api";
import { saveEventSession, type EventSession } from "@/app/lib/session";

export const eventAuthRepository = {
  login(input: { email: string; password: string }): Promise<EventSession> {
    return prismApi.login(input);
  },

  persistSession(session: EventSession): void {
    saveEventSession(session);
  },
};
