"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { useActiveWorkspace } from "@/contexts/ActiveWorkspaceContext";
import {
  listAdminTickets,
  TicketItem,
  ApiError,
} from "@/lib/api";

const LIMIT = 10;
const PAGINATION_KEY = "admin-tickets-pagination";

function loadPagination(): { cursor: string | null; cursorStack: (string | null)[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PAGINATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cursor: string | null; cursorStack: (string | null)[] };
    if (!Array.isArray(parsed.cursorStack)) return null;
    return { cursor: parsed.cursor ?? null, cursorStack: parsed.cursorStack };
  } catch {
    return null;
  }
}

function savePagination(cursor: string | null, cursorStack: (string | null)[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PAGINATION_KEY, JSON.stringify({ cursor, cursorStack }));
  } catch {
    // Ignore storage errors
  }
}

export default function AdminTicketsPage() {
  const router = useRouter();
  const {
    activeWorkspaceId: workspaceId,
    isSupportAgent,
    loading: workspaceLoading,
    error: workspaceError,
  } = useActiveWorkspace();
  const lastFetchedWorkspaceIdRef = useRef<string | null>(null);

  const [items, setItems] = useState<TicketItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(() => loadPagination()?.cursor ?? null);
  const [cursorStack, setCursorStack] = useState<(string | null)[]>(
    () => loadPagination()?.cursorStack ?? []
  );

  useEffect(() => {
    if (!workspaceId) return;
    const workspaceChanged = lastFetchedWorkspaceIdRef.current !== workspaceId;
    if (workspaceChanged) {
      lastFetchedWorkspaceIdRef.current = workspaceId;
      setCursor(null);
      setCursorStack([]);
      setItems([]);
      setNextCursor(null);
    }
    const cursorToUse = workspaceChanged ? null : cursor;
    setLoading(true);
    setError(null);
    listAdminTickets(workspaceId, { cursor: cursorToUse, limit: LIMIT })
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
  }, [workspaceId, cursor, router]);

  useEffect(() => {
    savePagination(cursor, cursorStack);
  }, [cursor, cursorStack]);

  function handleNext() {
    if (!nextCursor) return;
    const newStack = [...cursorStack, cursor];
    setCursorStack(newStack);
    setCursor(nextCursor);
  }

  function handleBack() {
    if (cursorStack.length === 0) return;
    const prev = cursorStack[cursorStack.length - 1];
    const newStack = cursorStack.slice(0, -1);
    setCursorStack(newStack);
    setCursor(prev);
  }

  if (workspaceLoading || workspaceError || !workspaceId) {
    return (
      <main className="min-h-screen p-8">
        <AppHeader />
        <p className="text-gray-600">
          {workspaceError ?? "Loading workspace..."}
        </p>
      </main>
    );
  }

  if (!isSupportAgent) {
    return (
      <main className="min-h-screen p-8">
        <AppHeader />
        <p className="mb-4 p-4 bg-amber-100 text-amber-900 rounded">
          Forbidden (Admin only)
        </p>
        <Link href="/app/tickets" className="text-blue-600 hover:underline">
          ← Back to my tickets
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <AppHeader />
      <div className="mb-6">
        <Link href="/app/tickets" className="text-blue-600 hover:underline">
          ← My tickets
        </Link>
      </div>
      <h2 className="text-xl font-semibold mb-4">All workspace tickets</h2>

      {loading && <p className="text-gray-600">Loading tickets...</p>}
      {error && (
        <p className="mb-4 p-3 bg-red-100 text-red-800 rounded text-sm">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="text-gray-600">No tickets yet.</p>
      )}
      {!loading && !error && items.length > 0 && (
        <>
          <ul className="space-y-3">
            {items.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/app/admin/tickets/${t.id}`}
                  className="block p-4 border rounded hover:bg-gray-50"
                >
                  <span className="font-medium">{t.title}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    ({t.status})
                  </span>
                  <span className="ml-2 text-sm text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                  <span className="ml-2 text-sm text-gray-500">
                    Owner: {t.createdByUserId}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex gap-4">
            <button
              onClick={handleBack}
              disabled={cursorStack.length === 0}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
            >
              Back
            </button>
            <button
              onClick={handleNext}
              disabled={!nextCursor}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}
