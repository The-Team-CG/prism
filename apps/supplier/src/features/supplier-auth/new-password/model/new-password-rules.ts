import { passwordSchema } from "@prism/types";

export function passwordsMatch(password: string, confirmPassword: string) {
  return password.length > 0 && password === confirmPassword;
}

export function newPasswordChecks(password: string, confirmPassword: string) {
  return [
    { id: "length", label: "12 to 128 characters", met: passwordSchema.safeParse(password).success },
    { id: "match", label: "Both passwords match", met: passwordsMatch(password, confirmPassword) },
  ];
}
