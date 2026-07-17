import { eventAuthRepository } from "../data/event-auth-repository";
import {
  eventRoleRejectionMessage,
  isEventPortalRole,
  resolveEventPostSignInPath,
} from "../model/event-sign-in-rules";

export async function signInToEventPortal(input: {
  email: string;
  password: string;
  nextPath?: string | null;
}): Promise<{ redirectTo: string } | { error: string }> {
  const session = await eventAuthRepository.login({
    email: input.email.trim(),
    password: input.password,
  });
  if (!isEventPortalRole(session.role)) {
    return { error: eventRoleRejectionMessage(session.role) };
  }
  eventAuthRepository.persistSession(session);
  return { redirectTo: resolveEventPostSignInPath(input.nextPath) };
}
