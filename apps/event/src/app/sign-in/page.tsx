"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Handshake, Shield } from "lucide-react";
import { PrismBrandLogo } from "@prism/ui";
import { prismApi } from "@/lib/prism-api";
import { Input } from "@/app/components/ui/input";
import { saveEventSession } from "@/app/lib/session";

const sampleAccounts = [
  { name: "Ms. Mys", role: "PMCM Admin", email: "mys@pmcm.test", password: "prism-admin" },
  { name: "Marco", role: "Coordinator", email: "marco@pmcm.test", password: "prism-coordinator" },
];

export default function EventSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("mys@pmcm.test");
  const [password, setPassword] = useState("prism-admin");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await prismApi.login({ email, password });
      if (session.role !== "pmcm-admin" && session.role !== "coordinator") {
        setError(
          session.role === "client"
            ? "Client accounts sign in through the client portal at http://localhost:3001."
            : "Supplier accounts sign in through the supplier portal at http://localhost:3002.",
        );
        return;
      }
      saveEventSession(session);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") ? next : "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f6f6]">
      <div className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
        <a
          href="/"
          aria-label="Back to P.R.I.S.M. home"
          className="inline-flex size-10 items-center justify-center rounded-full text-[#444] transition hover:bg-white hover:text-[#c01867] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c01867]/40"
        >
          <ArrowLeft className="size-5" />
        </a>

        <section className="mx-auto mt-6 w-full max-w-lg sm:mt-8">
          <div className="flex justify-center">
            <PrismBrandLogo
              detail="Event Command Portal"
              className="justify-center"
              markClassName="size-16 bg-transparent ring-0 sm:size-20"
            />
          </div>

          {/* Card */}
          <div className="mt-6 overflow-hidden rounded-xl border border-[#d9d9d9] shadow-[0_8px_22px_rgba(17,24,39,0.12)] sm:mt-8">
            {/* Header band */}
            <div className="flex items-center gap-3 bg-[#c01867] px-5 py-5 sm:px-6 sm:py-6">
              <div className="inline-flex size-10 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                <Handshake className="size-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white sm:text-[24px]">Welcome Back</h2>
                <p className="text-base text-white/90 sm:text-sm">Sign in to continue</p>
              </div>
            </div>

            {/* Form body */}
            <div className="bg-[#f6f6f6] px-4 py-6 sm:px-8 sm:py-8">
              <form className="space-y-5" onSubmit={submit}>
                <div>
                  <label htmlFor="email" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                    Email address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mys@pmcm.test"
                    className="h-13 rounded-lg border-[#d9d9d9] bg-white text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-base font-medium text-[#171216] sm:text-sm">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="h-13 rounded-lg border-[#d9d9d9] bg-white pr-11 text-base text-[#444] placeholder:text-[#a7a7a7] focus-visible:ring-1 focus-visible:ring-[#c01867] sm:h-12 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a7a7a7] transition hover:text-[#171216]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-[#b4233a]" role="alert">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex h-14 w-full items-center justify-center rounded-lg bg-[#c01867] text-lg font-semibold text-white transition hover:bg-[#a81459] disabled:cursor-not-allowed disabled:opacity-70 sm:h-12 sm:text-base"
                >
                  {busy ? "Signing in…" : "Sign in"}
                </button>
              </form>

              {/* Sample accounts */}
              <div className="mt-6 border-t border-[#d9d9d9] pt-5">
                <p className="mb-3 text-sm font-medium text-[#888888]">Sample accounts</p>
                <div className="flex flex-col gap-2">
                  {sampleAccounts.map((sample) => (
                    <button
                      key={sample.email}
                      type="button"
                      onClick={() => { setEmail(sample.email); setPassword(sample.password); }}
                      className="flex items-center justify-between rounded-lg border border-[#d9d9d9] bg-white px-4 py-3 text-left transition hover:border-[#c01867]/40 hover:bg-white/80"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#171216]">{sample.name}</p>
                        <p className="text-xs text-[#888888]">{sample.role}</p>
                      </div>
                      <ArrowRight className="size-4 text-[#a7a7a7]" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center sm:mt-10">
            <p className="inline-flex items-center gap-2 text-base text-[#888888] sm:text-sm">
              <Shield className="size-4" />
              Authorized PMCM team access only
            </p>
            <p className="mt-2 text-sm text-[#a0a0a0] sm:text-xs">
              Admin and coordinator accounts only. Other roles have separate portals.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
