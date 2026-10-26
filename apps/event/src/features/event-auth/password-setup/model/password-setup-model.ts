import { passwordSchema } from "@prism/types";

/** Live checklist for a new password and its confirmation. Shared by reset and activation. */
export function passwordSetupChecks(password: string, confirmPassword: string) {
  return [
    { id: "length", label: "12 to 128 characters", met: passwordSchema.safeParse(password).success },
    { id: "match", label: "Both passwords match", met: password.length > 0 && password === confirmPassword },
  ];
}

export type PasswordSetupCheck = ReturnType<typeof passwordSetupChecks>[number];
