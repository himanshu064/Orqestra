import "dotenv/config";

import { eq } from "drizzle-orm";

import type { ToolContext } from "@/ai/tools/context";
import { db } from "@/db";
import { documents, organizations, users } from "@/db/schema";
import { ingestDocument } from "@/services/documents";

const DOCS: { name: string; content: string }[] = [
  {
    name: "Enterprise Refund Policy.md",
    content: `# Enterprise Refund Policy

## Section 1  Scope
This policy governs refunds for Enterprise plan customers (annual contracts of $24,000/year or more).

## Section 2  Refund window
Enterprise customers may request a full refund within 30 days of the initial contract start date.
After 30 days, refunds are prorated for the remaining unused term, minus a 10% early-termination fee.

## Section 3  Eligibility
Refunds apply to prepaid, unused subscription time. Usage-based overages and professional-services
fees are non-refundable. Downgrades mid-term are credited toward the next renewal rather than refunded.

## Section 4  Process
Enterprise refund requests must be submitted by the account's billing owner and are reviewed by the
Customer Success team within 5 business days. Approved refunds are issued to the original payment method
within 10 business days.`,
  },
  {
    name: "Standard Refund Policy.md",
    content: `# Standard Refund Policy

Self-serve (Starter, Growth, Scale) customers may request a refund within 14 days of purchase for a
full refund, no questions asked. Monthly plans are not refundable after the 14-day window; simply cancel
to avoid the next charge. Refunds are issued to the original payment method within 5 business days.`,
  },
  {
    name: "Customer Support SOP.md",
    content: `# Customer Support SOP

## Section 3.2  Escalation
Tickets marked "urgent" or from Enterprise accounts are escalated to a senior engineer within 2 hours.
Billing disputes are routed to the Finance team. If a customer reports a usage decline or churn risk,
open a retention case and notify the assigned Customer Success Manager.

## Response targets
Enterprise: first response within 1 hour. Growth/Scale: within 4 hours. Starter: within 1 business day.`,
  },
  {
    name: "Pricing Guide.md",
    content: `# Pricing Guide

Starter: $99/mo. Growth: $399/mo. Scale: $1,499/mo. Enterprise: custom annual contracts starting at
$24,000/year with volume discounts, SSO, a dedicated CSM, and a 99.9% uptime SLA. Annual prepayment on
self-serve plans receives two months free.`,
  },
];

async function main() {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "orqestra-demo"))
    .limit(1);
  if (!org) throw new Error("Demo org not found  run `npm run db:seed`.");
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "manager@orqestra.demo"))
    .limit(1);

  const ctx: ToolContext = { organizationId: org.id, userId: user!.id };

  // Idempotent: clear existing docs (cascade removes chunks) then re-ingest.
  await db.delete(documents).where(eq(documents.organizationId, org.id));

  console.log("Seeding knowledge base…");
  for (const d of DOCS) {
    const res = await ingestDocument(ctx, {
      name: d.name,
      mimeType: "text/markdown",
      buffer: Buffer.from(d.content, "utf8"),
    });
    console.log(`  · ${d.name}: ${res.chunkCount} chunks`);
  }
  console.log("\n✅ Knowledge base seeded.");
}

main().catch((err) => {
  console.error("✗ kb seed failed:", err);
  process.exit(1);
});
