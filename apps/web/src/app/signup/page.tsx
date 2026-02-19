"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchJson } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { FormInput } from "@/components/ui/FormInput";

const features = [
  { label: "Multi-workspace support" },
  { label: "Role-based ticket access" },
  { label: "Real-time thread replies" },
];

export default function SignupPage() {
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
      await fetchJson("/auth/signup", {
        method: "POST",
        body: { email, password },
      });
      router.push("/app/tickets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel — brand hero */}
      <div className="lg:w-5/12 bg-gradient-to-br from-indigo-600 to-violet-600 flex flex-col justify-center px-10 py-14 text-white relative overflow-hidden">
        {/* Decorative rings */}
        <div
          className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 -right-20 w-64 h-64 rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full border border-white/5"
          aria-hidden="true"
        />

        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10">
          <svg width="36" height="36" viewBox="0 0 30 30" fill="none" aria-hidden="true">
            <rect width="30" height="30" rx="8" fill="white" fillOpacity="0.15" />
            <path
              d="M8 16C8 11.582 11.134 8 15 8C18.866 8 22 11.582 22 16"
              stroke="white"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <rect x="6.5" y="15.5" width="3.5" height="5.5" rx="1.5" fill="white" />
            <rect x="20" y="15.5" width="3.5" height="5.5" rx="1.5" fill="white" />
          </svg>
          <span className="font-semibold text-white text-lg tracking-tight">HelpNest</span>
        </div>

        <h2 className="text-3xl font-bold leading-snug mb-3">
          Customer support,<br />simplified.
        </h2>
        <p className="text-indigo-200 text-sm mb-10 leading-relaxed max-w-xs">
          Manage tickets, collaborate with your team, and resolve customer issues — all in one place.
        </p>

        <ul className="space-y-3">
          {features.map((f) => (
            <li key={f.label} className="flex items-center gap-3 text-sm text-indigo-100">
              <svg
                className="h-4 w-4 flex-shrink-0 text-indigo-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {f.label}
            </li>
          ))}
        </ul>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-white px-8 py-14">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h1>
          <p className="text-sm text-slate-500 mb-8">
            Start resolving tickets in minutes. No credit card needed.
          </p>

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
              label="Work email"
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
              minLength={8}
              autoComplete="new-password"
              placeholder="Min. 8 characters"
            />
            <Button type="submit" variant="primary" fullWidth disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
