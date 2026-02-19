"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { useActiveWorkspace } from "@/contexts/ActiveWorkspaceContext";
import {
  getTicket,
  postMessage,
  updateTicket,
  ApiError,
  TicketDetail,
  DbStatus,
  DbPriority,
} from "@/lib/api";

// ─── Status / priority display mapping ───────────────────────────────────────
// DB PENDING → UI "In Progress" is the key mapping. All DB values live here.

const STATUS_DISPLAY: Record<string, string> = {
  OPEN:     "Open",
  PENDING:  "In Progress",
  RESOLVED: "Resolved",
  CLOSED:   "Closed",
};

const STATUS_OPTIONS: { value: DbStatus; label: string }[] = [
  { value: "OPEN",     label: "Open" },
  { value: "PENDING",  label: "In Progress" },
  { value: "RESOLVED", label: "Resolved" },
];

const PRIORITY_DISPLAY: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

const PRIORITY_OPTIONS: { value: DbPriority; label: string }[] = [
  { value: null,     label: "None" },
  { value: "LOW",    label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH",   label: "High" },
];

// ─── Shared badge components ──────────────────────────────────────────────────
type KnownStatus = "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";

const statusStyles: Record<KnownStatus, string> = {
  OPEN:     "bg-blue-100 text-blue-700",
  PENDING:  "bg-amber-100 text-amber-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED:   "bg-slate-100 text-slate-600",
};

function StatusPill({ status }: { status: string }) {
  const style = statusStyles[status as KnownStatus] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {STATUS_DISPLAY[status] ?? status}
    </span>
  );
}

const priorityStyles: Record<string, string> = {
  LOW:    "bg-emerald-100 text-emerald-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH:   "bg-red-100 text-red-700",
};

function PriorityBadge({ priority }: { priority: string }) {
  const style = priorityStyles[priority] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {PRIORITY_DISPLAY[priority] ?? priority}
    </span>
  );
}

const inputBase =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 " +
  "placeholder:text-slate-400 transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

// ─── Page component ───────────────────────────────────────────────────────────
export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = String(params.ticketId);

  const {
    defaultWorkspaceRole,
    workspaces,
    activeWorkspaceId,
    defaultWorkspaceId,
    isSupportAgent,
  } = useActiveWorkspace();

  const workspaceId = activeWorkspaceId ?? defaultWorkspaceId;
  const activeWorkspace = workspaceId ? workspaces.find((w) => w.id === workspaceId) : null;
  const activeWorkspaceRole = activeWorkspace?.role ?? defaultWorkspaceRole ?? null;
  const isAdmin = isSupportAgent || activeWorkspaceRole === "ADMIN";

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const fetchTicket = useCallback(() => {
    setLoading(true);
    setError(null);
    getTicket(ticketId)
      .then((data) => setTicket(data.ticket))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setTicket(null);
        setError(
          err instanceof ApiError && err.status === 404
            ? "Ticket not found or you don't have access."
            : err instanceof Error
              ? err.message
              : "Failed to load ticket"
        );
      })
      .finally(() => setLoading(false));
  }, [ticketId, router]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyContent.trim()) return;
    setSubmitting(true);
    setReplyError(null);
    try {
      await postMessage(ticketId, replyContent.trim());
      setReplyContent("");
      fetchTicket();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setReplyError(
        err instanceof ApiError && err.status === 403
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to send reply"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(payload: { status?: DbStatus; priority?: DbPriority }) {
    setUpdating(true);
    setUpdateError(null);
    try {
      const res = await updateTicket(ticketId, payload);
      setTicket((prev) => (prev ? { ...prev, ...res.ticket } : null));
    } catch (err) {
      setUpdateError(err instanceof ApiError ? err.message : "Failed to update ticket");
    } finally {
      setUpdating(false);
    }
  }

  const isClosed = ticket?.status === "CLOSED";

  return (
    <AppShell>
      {/* Breadcrumb */}
      <Link
        href="/app/tickets"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors mb-6"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to tickets
      </Link>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
          <svg className="h-4 w-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading ticket…
        </div>
      )}

      {error && !ticket && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && ticket && (
        <div className="max-w-2xl">
          {/* Ticket header card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5 mb-6">
            {/* Status + priority badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <StatusPill status={ticket.status} />
              {ticket.priority && <PriorityBadge priority={ticket.priority} />}
              {ticket.category && (
                <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {ticket.category}
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-slate-900 leading-snug">{ticket.title}</h2>
            <p className="mt-1 text-xs text-slate-400">
              Created {new Date(ticket.createdAt).toLocaleString()} ·{" "}
              Updated {new Date(ticket.updatedAt).toLocaleString()}
            </p>

            {/* Admin controls */}
            {isAdmin && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                {updateError && (
                  <p className="mb-3 text-xs text-red-600">{updateError}</p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Status select — only shown when not closed */}
                  {!isClosed && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-medium text-slate-500">Status</label>
                      <select
                        value={ticket.status}
                        disabled={updating}
                        onChange={(e) => handleUpdate({ status: e.target.value as DbStatus })}
                        className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700
                          focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 transition-colors"
                      >
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Priority select */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-slate-500">Priority</label>
                    <select
                      value={ticket.priority ?? ""}
                      disabled={updating}
                      onChange={(e) =>
                        handleUpdate({ priority: (e.target.value || null) as DbPriority })
                      }
                      className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700
                        focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 transition-colors"
                    >
                      {PRIORITY_OPTIONS.map((o) => (
                        <option key={o.value ?? "__none"} value={o.value ?? ""}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Close / Reopen */}
                  {isClosed ? (
                    <button
                      disabled={updating}
                      onClick={() => handleUpdate({ status: "OPEN" })}
                      className="text-sm px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600
                        hover:bg-indigo-50 transition-colors disabled:opacity-50 font-medium"
                    >
                      Reopen ticket
                    </button>
                  ) : (
                    <button
                      disabled={updating}
                      onClick={() => handleUpdate({ status: "CLOSED" })}
                      className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600
                        hover:bg-slate-50 hover:border-slate-400 transition-colors disabled:opacity-50 font-medium"
                    >
                      Close ticket
                    </button>
                  )}

                  {updating && (
                    <svg className="h-4 w-4 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Thread */}
          <div className="space-y-3 mb-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Thread</h3>
            {ticket.messages.map((msg) => (
              <div key={msg.id} className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">
                    {msg.authorId.slice(0, 8)}…
                  </span>
                  <span>·</span>
                  <span>{new Date(msg.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            ))}
          </div>

          {/* Reply form */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
            {/* Closed banner for MEMBER */}
            {isClosed && !isAdmin ? (
              <div className="flex items-start gap-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0-6v2m-6 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-slate-700">This ticket is closed</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    New replies are disabled. Contact support to reopen this ticket.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Add a reply</h3>

                {/* Closed info banner for ADMIN */}
                {isClosed && isAdmin && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                    <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                    </svg>
                    Ticket is closed — you can still reply as admin.
                  </div>
                )}

                {replyError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {replyError}
                  </div>
                )}

                <form onSubmit={handleReply} className="space-y-4">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    required
                    rows={4}
                    maxLength={5000}
                    placeholder="Write your reply…"
                    className={inputBase}
                  />
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {submitting ? "Sending…" : "Send reply"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
