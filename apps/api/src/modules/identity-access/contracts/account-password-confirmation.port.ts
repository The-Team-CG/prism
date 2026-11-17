export const ACCOUNT_PASSWORD_CONFIRMATION = Symbol('ACCOUNT_PASSWORD_CONFIRMATION');

/**
 * Confirms that the signed-in person still knows their account password, for an action that needs proof of who they
 * are (such as a privacy request). Wrong passwords count toward the same lockout as sign-in.
 */
export interface AccountPasswordConfirmation {
  /**
   * Resolves with the moment the password was confirmed; rejects with 403 for a wrong password or a locked account.
   * Never 401: portals read a 401 as an expired session and sign the person out.
   */
  confirmPassword(accountId: string, password: string): Promise<Date>;
}
