import type { PrismAccountInvitationOutcome } from '@prism/types';

export const ACCOUNT_PROVISIONING = Symbol('ACCOUNT_PROVISIONING');
export const ACCOUNT_INVITATION_DELIVERY = Symbol('ACCOUNT_INVITATION_DELIVERY');

export const ACCOUNT_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Roles that get a login through an invitation. Guests use event codes and never receive one. */
export type InvitableAccountRole = 'client' | 'supplier' | 'pmcm-admin' | 'coordinator';

/** What caused the invitation. `inquiry_acceptance` is PMCM accepting a client's inquiry; the conforme is signed later. */
export type AccountInvitationSource = 'inquiry_acceptance' | 'supplier_application' | 'admin';

export interface AccountInvitationActor {
  id: string;
  name: string;
  role: string;
}

export interface ProvisionAccountInput {
  email: string;
  name: string;
  role: InvitableAccountRole;
  organization: string;
  source: AccountInvitationSource;
  sourceId: string | null;
  actor: AccountInvitationActor;
}

/** Creates or re-invites an account login. Other contexts reach it only through the reference module. */
export interface AccountProvisioningPort {
  provision(input: ProvisionAccountInput): Promise<PrismAccountInvitationOutcome>;
}

export interface AccountInvitationDeliveryPort {
  /** Resolves when the mail provider accepted the message; rejects otherwise, without the activation URL. */
  deliver(input: { recipient: string; name: string; role: InvitableAccountRole; activationUrl: string }): Promise<void>;
}
