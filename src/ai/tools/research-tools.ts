import { and, desc, eq, ilike } from "drizzle-orm";
import { tool } from "ai";
import { z } from "zod";

import { db } from "@/db";
import { customerEvents, customers, documents, invoices, supportTickets } from "@/db/schema";
import { centsToDollars } from "@/lib/business";
import { searchKnowledgeBase } from "@/services/knowledge-search";

import type { ToolContext } from "./context";
import { getSupportTicketsInput, querySupportTickets } from "./support-tools";

const customerHistoryInput = z
  .object({
    customerId: z.string().optional(),
    externalRef: z.string().optional().describe("e.g. CUS-1042"),
  })
  .refine((v) => v.customerId || v.externalRef, {
    message: "Provide customerId or externalRef",
  });
type CustomerHistoryInput = z.input<typeof customerHistoryInput>;

async function queryCustomerHistory(ctx: ToolContext, input: CustomerHistoryInput) {
  const ident = input.customerId
    ? eq(customers.id, input.customerId)
    : eq(customers.externalRef, input.externalRef!);
  const [c] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.organizationId, ctx.organizationId), ident))
    .limit(1);
  if (!c) return { found: false as const };

  const [tickets, recentInvoices, events] = await Promise.all([
    db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.customerId, c.id))
      .orderBy(desc(supportTickets.createdAt))
      .limit(5),
    db
      .select()
      .from(invoices)
      .where(eq(invoices.customerId, c.id))
      .orderBy(desc(invoices.dueAt))
      .limit(5),
    db
      .select()
      .from(customerEvents)
      .where(eq(customerEvents.customerId, c.id))
      .orderBy(desc(customerEvents.occurredAt))
      .limit(10),
  ]);

  return {
    found: true as const,
    customer: {
      externalRef: c.externalRef,
      name: c.name,
      company: c.company,
      plan: c.plan,
      mrr: centsToDollars(c.mrrCents),
      status: c.status,
      riskLevel: c.riskLevel,
      healthScore: c.healthScore,
      usageChangePct: c.usageChangePct,
    },
    supportTickets: tickets.map((t) => ({
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
    })),
    invoices: recentInvoices.map((i) => ({
      number: i.number,
      amount: centsToDollars(i.amountCents),
      status: i.status,
      dueAt: i.dueAt?.toISOString() ?? null,
    })),
    events: events.map((e) => ({
      type: e.type,
      value: e.value,
      occurredAt: e.occurredAt.toISOString(),
    })),
  };
}

export function createResearchTools(ctx: ToolContext) {
  return {
    searchKnowledgeBase: tool({
      description:
        "Semantic search over the company knowledge base (policies, SOPs, docs). Returns the most relevant chunks with their source document name  cite these as sources.",
      inputSchema: z.object({
        query: z.string(),
        k: z.number().int().min(1).max(10).default(5),
      }),
      execute: async ({ query, k }) => {
        const hits = await searchKnowledgeBase(ctx.organizationId, query, k ?? 5);
        return {
          hits: hits.map((h) => ({
            source: h.documentName,
            similarity: Number(h.similarity.toFixed(3)),
            content: h.content,
          })),
        };
      },
    }),
    searchDocuments: tool({
      description: "List knowledge-base documents, optionally filtered by name.",
      inputSchema: z.object({ nameContains: z.string().optional() }),
      execute: async ({ nameContains }) => {
        const where = nameContains
          ? and(
              eq(documents.organizationId, ctx.organizationId),
              ilike(documents.name, `%${nameContains}%`),
            )
          : eq(documents.organizationId, ctx.organizationId);
        const rows = await db
          .select({
            id: documents.id,
            name: documents.name,
            chunkCount: documents.chunkCount,
            status: documents.status,
          })
          .from(documents)
          .where(where);
        return { documents: rows };
      },
    }),
    getCustomerHistory: tool({
      description:
        "Fetch a customer's recent history: profile, recent support tickets, recent invoices, and recent activity events.",
      inputSchema: customerHistoryInput,
      execute: (input) => queryCustomerHistory(ctx, input),
    }),
    searchSupportTickets: tool({
      description:
        "List support tickets, optionally filtered by customer, status, priority, or category.",
      inputSchema: getSupportTicketsInput,
      execute: (input) => querySupportTickets(ctx, input),
    }),
    webSearch: tool({
      description: "Search the public web for external context.",
      inputSchema: z.object({ query: z.string() }),
      execute: async () => ({
        disabled: true,
        notice:
          "Live web research is a V2 feature and is disabled in this deployment. Use the knowledge base and customer data instead.",
      }),
    }),
  };
}
