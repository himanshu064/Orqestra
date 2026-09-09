import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";

import { db } from "@/db";
import { supportTickets, ticketStatus } from "@/db/schema";

import type { ToolContext } from "./context";

export const getSupportTicketsInput = z.object({
  customerId: z.string().optional(),
  status: z.enum(ticketStatus.enumValues).optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});
export type GetSupportTicketsInput = z.input<typeof getSupportTicketsInput>;

export async function querySupportTickets(ctx: ToolContext, input: GetSupportTicketsInput) {
  const conds: SQL[] = [eq(supportTickets.organizationId, ctx.organizationId)];
  if (input.customerId) conds.push(eq(supportTickets.customerId, input.customerId));
  if (input.status) conds.push(eq(supportTickets.status, input.status));
  if (input.priority) conds.push(eq(supportTickets.priority, input.priority));
  if (input.category) conds.push(eq(supportTickets.category, input.category));
  const where = and(...conds);
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(supportTickets)
      .where(where)
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(supportTickets).where(where),
  ]);

  return {
    tickets: rows.map((t) => ({
      id: t.id,
      customerId: t.customerId,
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      resolvedAt: t.resolvedAt?.toISOString() ?? null,
    })),
    total,
    returned: rows.length,
  };
}

export function createSupportTools(ctx: ToolContext) {
  return {
    getSupportTickets: tool({
      description:
        "List support tickets, optionally filtered by customer, status (open/pending/resolved/closed), priority, or category.",
      inputSchema: getSupportTicketsInput,
      execute: (input) => querySupportTickets(ctx, input),
    }),
  };
}
