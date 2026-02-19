import { z } from "zod";

export const createTicketSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be at most 200 characters"),
  message: z.string().min(1, "Message is required").max(5000, "Message must be at most 5000 characters"),
  category: z.string().max(50).optional(),
});

export const replyMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(5000, "Message must be at most 5000 characters"),
});

/**
 * Schema for PATCH /tickets/:ticketId (ADMIN only).
 * Accepts status and/or priority. At least one must be provided.
 *
 * Status values are DB values. Mapping to UI labels is done in the frontend:
 *   DB OPEN    → UI "Open"
 *   DB PENDING → UI "In Progress"  (key mapping: PENDING ↔ In Progress)
 *   DB RESOLVED → UI "Resolved"
 *   DB CLOSED  → UI "Closed" (set via Close button; separate from the status dropdown)
 */
export const patchTicketSchema = z
  .object({
    status: z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]).optional(),
    // null = clear priority (NONE); omit = leave unchanged
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable().optional(),
  })
  .refine((data) => data.status !== undefined || data.priority !== undefined, {
    message: "At least one of status or priority must be provided",
  });

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type ReplyMessageInput = z.infer<typeof replyMessageSchema>;
export type PatchTicketInput = z.infer<typeof patchTicketSchema>;

/** @deprecated Use patchTicketSchema */
export const patchTicketStatusSchema = z.object({
  status: z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]),
});
export type PatchTicketStatusInput = z.infer<typeof patchTicketStatusSchema>;
