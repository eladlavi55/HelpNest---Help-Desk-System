const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4001";

interface ApiErrorBody {
  error: { code: string; message: string };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchJson<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    cache?: RequestCache;
  } = {}
): Promise<T> {
  const { method = "GET", body, cache } = options;
  const res = await fetch(`${baseURL}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    ...(cache !== undefined && { cache }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
    const message =
      typeof data?.error?.message === "string" ? data.error.message : "Request failed";
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

// --- Ticket / workspace API helpers ---

export interface DefaultWorkspace {
  workspaceId: string;
  role: string;
  name: string;
  isSupportAgent?: boolean;
}

export async function getDefaultWorkspace(): Promise<DefaultWorkspace> {
  return fetchJson<DefaultWorkspace>("/workspaces/my-default");
}

export interface WorkspaceItem {
  id: string;
  name: string;
  kind: string;
  domain: string | null;
  role: string;
}

export interface GetWorkspacesResponse {
  workspaces: WorkspaceItem[];
}

export async function getWorkspaces(): Promise<GetWorkspacesResponse> {
  return fetchJson<GetWorkspacesResponse>("/workspaces");
}

/** DB status values. UI label mapping lives in the frontend (STATUS_DISPLAY constant). */
export type DbStatus = "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
/** DB priority values. null means NONE (no badge/color). */
export type DbPriority = "LOW" | "MEDIUM" | "HIGH" | null;

export interface TicketItem {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
}

export interface ListTicketsResponse {
  items: TicketItem[];
  nextCursor: string | null;
}

/**
 * List tickets for a workspace.
 * mine=true  → only tickets created by the current user (forced by API for MEMBER role).
 * mine=false → all tickets in the workspace (only honoured by API for ADMIN role).
 * cache: "no-store" prevents stale 304 responses in dev when switching workspaces.
 */
export function listTickets(
  workspaceId: string,
  opts?: { mine?: boolean; cursor?: string | null; limit?: number; sort?: string }
): Promise<ListTicketsResponse> {
  const limit = Math.min(10, Math.max(1, opts?.limit ?? 10));
  const params = new URLSearchParams({
    mine: String(opts?.mine ?? false),
    limit: String(limit),
  });
  if (opts?.cursor) params.set("cursor", opts.cursor);
  if (opts?.sort) params.set("sort", opts.sort);
  return fetchJson<ListTicketsResponse>(
    `/workspaces/${workspaceId}/tickets?${params.toString()}`,
    { cache: "no-store" }
  );
}

/** @deprecated Use listTickets({ mine: true }) */
export function listMyTickets(
  workspaceId: string,
  opts?: { cursor?: string | null; limit?: number }
): Promise<ListTicketsResponse> {
  return listTickets(workspaceId, { mine: true, ...opts });
}

/** @deprecated Use listTickets({ mine: false }) */
export function listAdminTickets(
  workspaceId: string,
  opts?: { cursor?: string | null; limit?: number }
): Promise<ListTicketsResponse> {
  return listTickets(workspaceId, { mine: false, ...opts });
}

export interface PatchTicketPayload {
  status?: DbStatus;
  priority?: DbPriority;
}

export interface PatchTicketResponse {
  ticket: {
    id: string;
    title: string;
    status: string;
    priority: string | null;
    updatedAt: string;
    createdAt: string;
  };
}

/**
 * Update ticket status and/or priority (ADMIN only).
 * Status values are DB values; the frontend maps DB PENDING → UI "In Progress".
 * To close a ticket: pass { status: "CLOSED" }.
 * To reopen:         pass { status: "OPEN" }.
 * To clear priority: pass { priority: null }.
 */
export function updateTicket(
  ticketId: string,
  payload: PatchTicketPayload
): Promise<PatchTicketResponse> {
  return fetchJson<PatchTicketResponse>(`/tickets/${ticketId}`, {
    method: "PATCH",
    body: payload,
  });
}

/** @deprecated Use updateTicket({ status }) */
export function updateTicketStatus(
  ticketId: string,
  status: "OPEN" | "PENDING" | "RESOLVED" | "CLOSED"
): Promise<{ ticket: { id: string; title: string; status: string; createdAt: string } }> {
  return fetchJson(`/tickets/${ticketId}`, {
    method: "PATCH",
    body: { status },
  });
}

export interface CreateTicketPayload {
  title: string;
  message: string;
  category?: string;
}

export interface CreateTicketResponse {
  ticket: { id: string; title: string; status: string; createdAt: string };
}

export function createTicket(
  workspaceId: string,
  payload: CreateTicketPayload
): Promise<CreateTicketResponse> {
  return fetchJson<CreateTicketResponse>(`/workspaces/${workspaceId}/tickets`, {
    method: "POST",
    body: payload,
  });
}

export interface TicketMessage {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface TicketDetail {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  messages: TicketMessage[];
}

export interface GetTicketResponse {
  ticket: TicketDetail;
}

export function getTicket(ticketId: string): Promise<GetTicketResponse> {
  return fetchJson<GetTicketResponse>(`/tickets/${ticketId}`);
}

export function postMessage(
  ticketId: string,
  message: string
): Promise<{ message: TicketMessage }> {
  return fetchJson<{ message: TicketMessage }>(
    `/tickets/${ticketId}/messages`,
    { method: "POST", body: { message } }
  );
}
