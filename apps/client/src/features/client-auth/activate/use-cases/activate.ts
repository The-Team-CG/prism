import { activateAccountSchema, parseContract, type ActivateAccountInput } from "@prism/types";
import { clientAuthRepository } from "../../sign-in/data/client-auth-repository";

export async function activateClientAccount(input: ActivateAccountInput) {
  const payload = parseContract(activateAccountSchema, input, "Account activation");
  return clientAuthRepository.activateAccount(payload);
}
