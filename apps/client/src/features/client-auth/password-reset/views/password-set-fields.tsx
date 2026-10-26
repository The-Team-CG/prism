import { Eye, EyeOff } from "lucide-react";
import { PRISM_AUTH_INPUT_CLASS_NAME } from "@prism/ui/auth-shell";
import { Field } from "@/app/components/ui/field";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { passwordResetChecks } from "../model/password-reset-model";

export function PasswordSetFields({
  password,
  confirmPassword,
  showPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onShowPasswordChange,
}: {
  password: string;
  confirmPassword: string;
  showPassword: boolean;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onShowPasswordChange: (show: boolean) => void;
}) {
  const checks = passwordResetChecks(password, confirmPassword);
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <>
      <Field>
        <Label htmlFor="new-password">New password</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            aria-describedby="password-checklist"
            className={`h-12 rounded-lg bg-card pr-12 text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
          />
          <button
            type="button"
            onClick={() => onShowPasswordChange(!showPassword)}
            className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </Field>
      <Field>
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
          aria-invalid={mismatch ? true : undefined}
          aria-describedby={mismatch ? "confirm-password-error" : undefined}
          className={`h-12 rounded-lg bg-card text-base ${PRISM_AUTH_INPUT_CLASS_NAME}`}
        />
        {mismatch ? (
          <p id="confirm-password-error" className="text-sm text-destructive">
            Passwords do not match.
          </p>
        ) : null}
      </Field>
      <ul id="password-checklist" className="flex flex-col gap-1.5 text-sm">
        {checks.map((check) => (
          <li key={check.id} className={check.met ? "text-foreground" : "text-muted-foreground"}>
            <span aria-hidden="true">{check.met ? "✓ " : "○ "}</span>
            {check.label}
          </li>
        ))}
      </ul>
    </>
  );
}
