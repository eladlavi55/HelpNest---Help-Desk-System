"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { FormInput } from "@/components/ui/FormInput";
import { useActiveWorkspace } from "@/contexts/ActiveWorkspaceContext";
import { createTicket, ApiError } from "@/lib/api";

const inputBase =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 " +
  "placeholder:text-slate-400 transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

export default function NewTicketPage() {
  const router = useRouter();
  const {
    defaultWorkspaceId: workspaceId,
    loading: workspaceLoading,
    error: workspaceError,
  } = useActiveWorkspace();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await createTicket(workspaceId, {
        title: title.trim(),
        message: message.trim(),
        ...(category.trim() && { category: category.trim() }),
      });
      router.push(`/app/tickets/${res.ticket.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  }

  if (workspaceLoading || workspaceError) {
    return (
      <AppShell>
        <p className="text-slate-500">{workspaceError ?? "Loading workspace…"}</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Breadcrumb */}
      <Link
        href="/app/tickets"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 transition-colors mb-6"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to tickets
      </Link>

      <div className="max-w-xl">
        <h2 className="text-xl font-semibold text-slate-900 mb-1">New ticket</h2>
        <p className="text-sm text-slate-500 mb-7">
          Describe your issue and our team will get back to you.
        </p>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormInput
              id="title"
              label="Title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              placeholder="Brief summary of the issue"
            />

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Message
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={5}
                maxLength={5000}
                placeholder="Describe your issue in detail…"
                className={inputBase}
              />
            </div>

            <FormInput
              id="category"
              label="Category (optional)"
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={50}
              placeholder="e.g. billing, auth, general"
            />

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? "Creating…" : "Create ticket"}
              </Button>
              <Link
                href="/app/tickets"
                className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
