"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchJson } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { FormInput } from "@/components/ui/FormInput";

function HelpNestLogo() {
  return (
    <svg width="36" height="36" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <rect width="30" height="30" rx="8" fill="#4f46e5" />
      <path
        d="M8 16C8 11.582 11.134 8 15 8C18.866 8 22 11.582 22 16"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <rect x="6.5" y="15.5" width="3.5" height="5.5" rx="1.5" fill="white" />
      <rect x="20" y="15.5" width="3.5" height="5.5" rx="1.5" fill="white" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await fetchJson("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      router.push("/app/tickets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-50 flex items-center justify-center p-6 overflow-hidden">
      {/* Decorative blobs */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-indigo-200 opacity-30 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-violet-200 opacity-30 blur-3xl"
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl ring-1 ring-slate-100 px-8 py-10">
        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-8">
          <HelpNestLogo />
          <span className="mt-2 font-semibold text-slate-900 text-lg tracking-tight">
            HelpNest
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h1>
        <p className="text-sm text-slate-500 mb-7">Sign in to your account to continue.</p>

        {error && (
          <div
            className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3m0 3h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormInput
            id="email"
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@company.com"
          />
          <FormInput
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <Button type="submit" variant="primary" fullWidth disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
