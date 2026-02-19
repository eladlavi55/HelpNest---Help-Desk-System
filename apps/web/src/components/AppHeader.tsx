"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchJson, ApiError } from "@/lib/api";
import { useActiveWorkspace } from "@/contexts/ActiveWorkspaceContext";

interface MeResponse {
  user: { id: string; email: string };
}

function HelpNestLogo() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <rect width="30" height="30" rx="8" fill="#4f46e5" />
      {/* Headset arc */}
      <path
        d="M8 16C8 11.582 11.134 8 15 8C18.866 8 22 11.582 22 16"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Left ear */}
      <rect x="6.5" y="15.5" width="3.5" height="5.5" rx="1.5" fill="white" />
      {/* Right ear */}
      <rect x="20" y="15.5" width="3.5" height="5.5" rx="1.5" fill="white" />
    </svg>
  );
}

export function AppHeader() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const {
    workspaces,
    activeWorkspaceId,
    setActiveWorkspaceId,
    defaultWorkspaceId,
    defaultWorkspaceRole,
    isSupportAgent,
  } = useActiveWorkspace();

  useEffect(() => {
    fetchJson<MeResponse>("/me")
      .then((data) => setEmail(data.user.email))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        }
      });
  }, [router]);

  async function handleLogout() {
    try {
      await fetchJson("/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  const accountLabel = isSupportAgent ? "Support Agent" : "Member";
  const activeWorkspace = activeWorkspaceId
    ? workspaces.find((w) => w.id === activeWorkspaceId)
    : workspaces.find((w) => w.id === defaultWorkspaceId);
  const workspaceRole = activeWorkspace?.role ?? defaultWorkspaceRole ?? null;
  const workspaceName =
    activeWorkspace?.name ?? (!isSupportAgent ? workspaces[0]?.name ?? null : null);

  return (
    <nav className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-4">
        {/* Brand */}
        <Link
          href="/app/tickets"
          className="flex items-center gap-2 flex-shrink-0 group"
        >
          <HelpNestLogo />
          <span className="font-semibold text-slate-900 text-[15px] group-hover:text-indigo-600 transition-colors">
            HelpNest
          </span>
        </Link>

        <div className="flex-1" />

        {/* Workspace selector — support agents only */}
        {isSupportAgent && workspaces.length > 0 && (
          <select
            value={activeWorkspaceId ?? ""}
            onChange={(e) => setActiveWorkspaceId(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700
              focus:outline-none focus:ring-2 focus:ring-indigo-400 hover:border-slate-300
              transition-colors cursor-pointer"
            aria-label="Switch workspace"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.kind})
              </option>
            ))}
          </select>
        )}

        {/* Workspace name + role badge */}
        {(workspaceName || workspaceRole) && (
          <span className="hidden sm:flex items-center gap-1.5 text-xs">
            {workspaceName && (
              <span className="font-medium text-slate-700">{workspaceName}</span>
            )}
            {workspaceName && workspaceRole && (
              <span className="text-slate-300">·</span>
            )}
            {workspaceRole && (
              <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-medium">
                {workspaceRole}
              </span>
            )}
          </span>
        )}

        {/* User email + account type */}
        <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-medium text-slate-700">{email ?? "…"}</span>
          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
            {accountLabel}
          </span>
        </span>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600
            hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
