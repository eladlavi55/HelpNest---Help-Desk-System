"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { useActiveWorkspace } from "@/contexts/ActiveWorkspaceContext";
import {
  listTickets,
  updateTicket,
  TicketItem,
  ApiError,
  DbStatus,
  DbPriority,
} from "@/lib/api";

const LIMIT = 10;

// ─── Status mapping ───────────────────────────────────────────────────────────
// DB values are always sent to / received from the API.
// UI labels are only used for display. This is the single place for the mapping.
// Key rule: DB PENDING ↔ UI "In Progress".
const STATUS_DISPLAY: Record<string, string> = {
  OPEN: "Open",
  PENDING: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

// Options for the status dropdown (does NOT include CLOSED — use the Close button).
const STATUS_OPTIONS: { value: DbStatus; label: string }[] = [
  { value: "OPEN",     label: "Open" },
  { value: "PENDING",  label: "In Progress" },
  { value: "RESOLVED", label: "Resolved" },
];

// ─── Priority mapping ─────────────────────────────────────────────────────────
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

// ─── Sort options ─────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: "createdAt", label: "Newest first" },
  { value: "updatedAt", label: "Last updated" },
  { value: "title",     label: "Title A→Z" },
  { value: "status",    label: "Status" },
  { value: "priority",  label: "Priority" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

// ─── Status pill ──────────────────────────────────────────────────────────────
type KnownStatus = "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";

const statusStyles: Record<KnownStatus, string> = {
  OPEN:     "bg-blue-100 text-blue-700",
  PENDING:  "bg-amber-100 text-amber-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED:   "bg-slate-100 text-slate-600",
};

function StatusPill({ status }: { status: string }) {
  const style = statusStyles[status as KnownStatus] ?? "bg-slate-100 text-slate-600";
  const label = STATUS_DISPLAY[status] ?? status;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

// ─── Priority badge ───────────────────────────────────────────────────────────
const priorityStyles: Record<string, string> = {
  LOW:    "bg-emerald-100 text-emerald-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH:   "bg-red-100 text-red-700",
};

function PriorityBadge({ priority }: { priority: string }) {
  const style = priorityStyles[priority] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {PRIORITY_DISPLAY[priority] ?? priority}
    </span>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────
export default function TicketsPage() {
  const router = useRouter();
  const {
    activeWorkspaceId,
    defaultWorkspaceId,
    defaultWorkspaceRole,
    workspaces,
    isSupportAgent,
    loading: workspaceLoading,
    error: workspaceError,
  } = useActiveWorkspace();

  const workspaceId = activeWorkspaceId ?? defaultWorkspaceId;

  const activeWorkspace = workspaceId
    ? workspaces.find((w) => w.id === workspaceId)
    : null;
  const activeWorkspaceRole = activeWorkspace?.role ?? defaultWorkspaceRole ?? null;
  const canViewAll = isSupportAgent || activeWorkspaceRole === "ADMIN";

  // mine=false → "All tickets" (default for admins/agents)
  // mine=true  → "My tickets"
  const [mine, setMine] = useState(false);
  const [sort, setSort] = useState<SortValue>("createdAt");

  const [items, setItems] = useState<TicketItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks which ticket IDs are being updated to disable their controls.
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // Reset + fetch when workspace, mine filter, or sort changes.
  useEffect(() => {
    if (!workspaceId || workspaceLoading) return;
    const effectiveMine = canViewAll ? mine : true;
    setLoading(true);
    setError(null);
    setItems([]);
    setNextCursor(null);
    listTickets(workspaceId, { mine: effectiveMine, limit: LIMIT, sort })
      .then((data) => {
        setItems(data.items);
        setNextCursor(data.nextCursor);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load tickets");
      })
      .finally(() => setLoading(false));
  }, [workspaceId, mine, sort, workspaceLoading, canViewAll, router]);

  async function handleLoadMore() {
    if (!nextCursor || !workspaceId || loadingMore) return;
    const effectiveMine = canViewAll ? mine : true;
    setLoadingMore(true);
    try {
      const data = await listTickets(workspaceId, {
        mine: effectiveMine,
        cursor: nextCursor,
        limit: LIMIT,
        sort,
      });
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.replace("/login");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleUpdateTicket(ticketId: string, payload: { status?: DbStatus; priority?: DbPriority }) {
    setUpdatingIds((prev) => new Set(prev).add(ticketId));
    try {
      const res = await updateTicket(ticketId, payload);
      setItems((prev) =>
        prev.map((item) =>
          item.id === ticketId ? { ...item, ...res.ticket } : item
        )
      );
    } catch (err) {
      // Surface error without navigating away
      setError(err instanceof ApiError ? err.message : "Failed to update ticket");
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
    }
  }

  function handleToggleMine(newMine: boolean) {
    if (newMine === mine) return;
    setMine(newMine);
  }

  function handleSortChange(newSort: SortValue) {
    if (newSort === sort) return;
    setSort(newSort);
  }

  if (workspaceLoading || workspaceError) {
    return (
      <AppShell>
        <p className="text-slate-500">{workspaceError ?? "Loading workspace…"}</p>
      </AppShell>
    );
  }

  const viewLabel = canViewAll && !mine ? "All workspace tickets" : "My tickets";

  return (
    <AppShell>
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Tickets</h2>
          <p className="text-sm text-slate-500 mt-0.5">{viewLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Sort dropdown — admin only */}
          {canViewAll && (
            <select
              value={sort}
              onChange={(e) => handleSortChange(e.target.value as SortValue)}
              className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700
                focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors"
              aria-label="Sort tickets"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}

          {/* Segmented control — admin only */}
          {canViewAll && (
            <div className="flex rounded-lg overflow-hidden border border-slate-200 text-sm">
              <button
                onClick={() => handleToggleMine(false)}
                className={[
                  "px-4 py-1.5 font-medium transition-colors",
                  !mine ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                All tickets
              </button>
              <button
                onClick={() => handleToggleMine(true)}
                className={[
                  "px-4 py-1.5 font-medium transition-colors border-l border-slate-200",
                  mine ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50",
                ].join(" ")}
              >
                My tickets
              </button>
            </div>
          )}

          <Link
            href="/app/tickets/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New ticket
          </Link>
        </div>
      </div>

      {/* Sort note for non-cursor sorts */}
      {canViewAll && sort !== "createdAt" && sort !== "updatedAt" && (
        <p className="text-xs text-slate-400 mb-4">
          Showing first {LIMIT} results. Switch to &quot;Newest first&quot; or &quot;Last updated&quot; for full pagination.
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
          <svg className="h-4 w-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Loading tickets…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
            <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="font-medium text-slate-700">No tickets yet</p>
          <p className="mt-1 text-sm text-slate-400">
            {canViewAll && !mine ? "No tickets in this workspace." : "You haven't created any tickets yet."}
          </p>
        </div>
      )}

      {/* Ticket list */}
      {!loading && !error && items.length > 0 && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <ul className="divide-y divide-slate-100">
              {items.map((t) => {
                const isUpdating = updatingIds.has(t.id);
                const isClosed = t.status === "CLOSED";
                return (
                  <li key={t.id}>
                    <div className="px-5 py-4 hover:bg-slate-50 transition-colors">
                      {/* Row: title + meta */}
                      <div className="flex items-center justify-between gap-4">
                        <Link
                          href={`/app/tickets/${t.id}`}
                          className="group flex items-center gap-3 min-w-0 flex-1"
                        >
                          <StatusPill status={t.status} />
                          <span className="truncate font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {t.title}
                          </span>
                        </Link>
                        <div className="flex flex-shrink-0 items-center gap-2 text-xs text-slate-400">
                          {t.priority && <PriorityBadge priority={t.priority} />}
                          {t.category && (
                            <span className="hidden sm:inline-block rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                              {t.category}
                            </span>
                          )}
                          <span title={`Updated ${new Date(t.updatedAt).toLocaleString()}`}>
                            {new Date(t.updatedAt).toLocaleDateString()}
                          </span>
                          <Link href={`/app/tickets/${t.id}`} tabIndex={-1}>
                            <svg className="h-4 w-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </div>
                      </div>

                      {/* Admin inline controls */}
                      {canViewAll && (
                        <div
                          className="mt-2 pl-1 flex flex-wrap items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Status dropdown (hidden when closed; replaced by Reopen) */}
                          {!isClosed && (
                            <select
                              value={t.status}
                              disabled={isUpdating}
                              onChange={(e) =>
                                handleUpdateTicket(t.id, { status: e.target.value as DbStatus })
                              }
                              className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700
                                focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50
                                hover:border-slate-300 transition-colors"
                              aria-label="Change status"
                            >
                              {STATUS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          )}

                          {/* Priority dropdown */}
                          <select
                            value={t.priority ?? ""}
                            disabled={isUpdating}
                            onChange={(e) =>
                              handleUpdateTicket(t.id, {
                                priority: (e.target.value || null) as DbPriority,
                              })
                            }
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700
                              focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50
                              hover:border-slate-300 transition-colors"
                            aria-label="Change priority"
                          >
                            {PRIORITY_OPTIONS.map((o) => (
                              <option key={o.value ?? "__none"} value={o.value ?? ""}>
                                {o.label}
                              </option>
                            ))}
                          </select>

                          {/* Close / Reopen button */}
                          {isClosed ? (
                            <button
                              disabled={isUpdating}
                              onClick={() => handleUpdateTicket(t.id, { status: "OPEN" })}
                              className="text-xs px-2.5 py-1 rounded border border-indigo-200 text-indigo-600
                                hover:bg-indigo-50 transition-colors disabled:opacity-50"
                            >
                              Reopen
                            </button>
                          ) : (
                            <button
                              disabled={isUpdating}
                              onClick={() => handleUpdateTicket(t.id, { status: "CLOSED" })}
                              className="text-xs px-2.5 py-1 rounded border border-slate-200 text-slate-600
                                hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
                            >
                              Close
                            </button>
                          )}

                          {isUpdating && (
                            <svg className="h-3.5 w-3.5 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Load more — only shown when cursor pagination is active */}
          {nextCursor && (
            <div className="mt-5 text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-lg border border-slate-300 bg-white px-6 py-2 text-sm font-medium text-slate-600
                  hover:border-slate-400 hover:bg-slate-50 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
