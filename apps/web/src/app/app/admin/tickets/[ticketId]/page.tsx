"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { useActiveWorkspace } from "@/contexts/ActiveWorkspaceContext";
import {
  getTicket,
  postMessage,
  updateTicketStatus,
  ApiError,
  TicketDetail,
} from "@/lib/api";

const STATUS_OPTIONS = ["OPEN", "PENDING", "RESOLVED", "CLOSED"] as const;

export default function AdminTicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = String(params.ticketId);
  const { isSupportAgent, loading: workspaceLoading, error: workspaceError } =
    useActiveWorkspace();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchTicket = useCallback(() => {
    setLoading(true);
    setError(null);
    getTicket(ticketId)
      .then((data) => {
        setTicket(data.ticket);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setTicket(null);
        setError(
          err instanceof ApiError && err.status === 404
            ? "Ticket not found"
            : err instanceof Error
              ? err.message
              : "Failed to load ticket"
        );
      })
      .finally(() => setLoading(false));
  }, [ticketId, router]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

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
      setReplyError(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(
    e: React.ChangeEvent<HTMLSelectElement>
  ) {
    const newStatus = e.target.value as (typeof STATUS_OPTIONS)[number];
    setStatusUpdating(true);
    try {
      await updateTicketStatus(ticketId, newStatus);
      fetchTicket();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  }

  if (workspaceLoading || workspaceError) {
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
        <Link href="/app/admin/tickets" className="text-blue-600 hover:underline">
          ← All tickets
        </Link>
      </div>

      {loading && <p className="text-gray-600">Loading...</p>}
      {error && !ticket && (
        <p className="mb-4 p-3 bg-red-100 text-red-800 rounded text-sm">
          {error}
        </p>
      )}
      {!loading && ticket && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-semibold">{ticket.title}</h2>
            <div className="mt-2 flex items-center gap-4">
              <label className="text-sm text-gray-600">
                Status:
                <select
                  value={ticket.status}
                  onChange={handleStatusChange}
                  disabled={statusUpdating}
                  className="ml-2 border rounded px-2 py-1"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              {ticket.category && (
                <span className="text-sm text-gray-500">
                  Category: {ticket.category}
                </span>
              )}
              <span className="text-sm text-gray-500">
                Owner: {ticket.createdByUserId}
              </span>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <h3 className="font-medium">Messages</h3>
            {ticket.messages.map((msg) => (
              <div key={msg.id} className="p-4 border rounded bg-gray-50">
                <div className="text-xs text-gray-500 mb-1">
                  {msg.authorId} · {new Date(msg.createdAt).toLocaleString()}
                </div>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleReply} className="space-y-4">
            <h3 className="font-medium">Reply</h3>
            {replyError && (
              <p className="p-3 bg-red-100 text-red-800 rounded text-sm">
                {replyError}
              </p>
            )}
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              required
              rows={3}
              maxLength={5000}
              placeholder="Your reply..."
              className="w-full border rounded px-3 py-2"
            />
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending..." : "Send reply"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}
