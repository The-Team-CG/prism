"use client";

import { FormEvent, useEffect, useState } from "react";
import { eventAuthRepository } from "@/features/event-auth/sign-in/data/event-auth-repository";

export default function PasswordResetPage() {
  const [email, setEmail] = useState(""); const [token, setToken] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => setToken(new URLSearchParams(window.location.search).get("token") ?? ""), []);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); try { const result = token ? await eventAuthRepository.consumePasswordReset({ token, password }) : await eventAuthRepository.requestPasswordReset(email); setMessage(result.message); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to process password reset"); } finally { setBusy(false); } }
  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-6"><form onSubmit={submit} className="w-full space-y-5 rounded-xl border border-[#d9d9d9] bg-white p-8 shadow-sm"><h1 className="text-2xl font-semibold">Reset your password</h1><p className="text-sm text-[#666]">Use the trusted reset link from PMCM, or request a new one.</p>{!token && <label className="block text-sm">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-11 w-full rounded border p-2" /></label>}{token && <label className="block text-sm">New password<input required minLength={12} maxLength={128} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-11 w-full rounded border p-2" /></label>}<button disabled={busy} className="h-11 w-full rounded bg-[#c01867] font-semibold text-white">{busy ? "Processing…" : token ? "Set password" : "Request reset"}</button>{message && <p role="status" className="text-sm text-[#555]">{message}</p>}</form></main>;
}
