import { and, count, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";

import { db } from "@/db";
import { invoices, invoiceStatus, orders, subscriptions, subscriptionStatus } from "@/db/schema";
import { centsToDollars, dollarsToCents } from "@/lib/business";

import type { ToolContext } from "./context";

const pageInput = {
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
};

// --- getOrders ----------------------------------------------------------------
export const getOrdersInput = z.object({
  customerId: z.string().optional(),
  status: z.string().optional(),
  since: z.string().optional().describe("ISO date; only orders placed on/after this"),
  until: z.string().optional().describe("ISO date; only orders placed on/before this"),
  minAmount: z.number().nonnegative().optional().describe("Minimum order amount, in dollars"),
  ...pageInput,
});
export type GetOrdersInput = z.input<typeof getOrdersInput>;

export async function queryOrders(ctx: ToolContext, input: GetOrdersInput) {
  const conds: SQL[] = [eq(orders.organizationId, ctx.organizationId)];
  if (input.customerId) conds.push(eq(orders.customerId, input.customerId));
  if (input.status) conds.push(eq(orders.status, input.status));
  if (input.since) conds.push(gte(orders.placedAt, new Date(input.since)));
  if (input.until) conds.push(sql`${orders.placedAt} <= ${new Date(input.until)}`);
  if (input.minAmount !== undefined)
    conds.push(gte(orders.amountCents, dollarsToCents(input.minAmount)));
  const where = and(...conds);
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const [rows, [agg]] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.placedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count(), sum: sql<number>`coalesce(sum(${orders.amountCents}), 0)` })
      .from(orders)
      .where(where),
  ]);

  return {
    orders: rows.map((o) => ({
      id: o.id,
      customerId: o.customerId,
      amount: centsToDollars(o.amountCents),
      status: o.status,
      placedAt: o.placedAt?.toISOString() ?? null,
    })),
    total: Number(agg.total),
    returned: rows.length,
    totalAmount: centsToDollars(Number(agg.sum)),
  };
}

// --- getInvoices --------------------------------------------------------------
export const getInvoicesInput = z.object({
  customerId: z.string().optional(),
  status: z.enum(invoiceStatus.enumValues).optional(),
  minAmount: z.number().nonnegative().optional().describe("Minimum invoice amount, in dollars"),
  ...pageInput,
});
export type GetInvoicesInput = z.input<typeof getInvoicesInput>;

export async function queryInvoices(ctx: ToolContext, input: GetInvoicesInput) {
  const conds: SQL[] = [eq(invoices.organizationId, ctx.organizationId)];
  if (input.customerId) conds.push(eq(invoices.customerId, input.customerId));
  if (input.status) conds.push(eq(invoices.status, input.status));
  if (input.minAmount !== undefined)
    conds.push(gte(invoices.amountCents, dollarsToCents(input.minAmount)));
  const where = and(...conds);
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const [rows, [agg]] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(where)
      .orderBy(desc(invoices.dueAt))
      .limit(limit)
      .offset(offset),
    db
      .select({
        total: count(),
        outstanding: sql<number>`coalesce(sum(${invoices.amountCents}) filter (where ${invoices.status} in ('open','overdue','failed')), 0)`,
      })
      .from(invoices)
      .where(where),
  ]);

  return {
    invoices: rows.map((i) => ({
      id: i.id,
      customerId: i.customerId,
      number: i.number,
      amount: centsToDollars(i.amountCents),
      status: i.status,
      dueAt: i.dueAt?.toISOString() ?? null,
      paidAt: i.paidAt?.toISOString() ?? null,
    })),
    total: Number(agg.total),
    returned: rows.length,
    outstandingAmount: centsToDollars(Number(agg.outstanding)),
  };
}

// --- getSubscriptions ---------------------------------------------------------
export const getSubscriptionsInput = z.object({
  customerId: z.string().optional(),
  status: z.enum(subscriptionStatus.enumValues).optional(),
  ...pageInput,
});
export type GetSubscriptionsInput = z.input<typeof getSubscriptionsInput>;

export async function querySubscriptions(ctx: ToolContext, input: GetSubscriptionsInput) {
  const conds: SQL[] = [eq(subscriptions.organizationId, ctx.organizationId)];
  if (input.customerId) conds.push(eq(subscriptions.customerId, input.customerId));
  if (input.status) conds.push(eq(subscriptions.status, input.status));
  const where = and(...conds);
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(subscriptions).where(where).limit(limit).offset(offset),
    db.select({ total: count() }).from(subscriptions).where(where),
  ]);

  return {
    subscriptions: rows.map((s) => ({
      id: s.id,
      customerId: s.customerId,
      plan: s.plan,
      status: s.status,
      mrr: centsToDollars(s.mrrCents),
      startedAt: s.startedAt?.toISOString() ?? null,
      renewsAt: s.renewsAt?.toISOString() ?? null,
      canceledAt: s.canceledAt?.toISOString() ?? null,
    })),
    total,
    returned: rows.length,
  };
}

// --- tool wrappers ------------------------------------------------------------
export function createSalesTools(ctx: ToolContext) {
  return {
    getOrders: tool({
      description:
        "List orders, optionally filtered by customer, status, date range, or minimum amount. Returns rows plus total count and total amount.",
      inputSchema: getOrdersInput,
      execute: (input) => queryOrders(ctx, input),
    }),
    getInvoices: tool({
      description:
        "List invoices, optionally filtered by customer, status (open/overdue/failed/paid/…), or minimum amount. Returns rows plus total count and outstanding amount.",
      inputSchema: getInvoicesInput,
      execute: (input) => queryInvoices(ctx, input),
    }),
    getSubscriptions: tool({
      description: "List subscriptions, optionally filtered by customer or status.",
      inputSchema: getSubscriptionsInput,
      execute: (input) => querySubscriptions(ctx, input),
    }),
  };
}
