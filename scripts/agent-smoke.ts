import "dotenv/config";

import { eq } from "drizzle-orm";

import { dataAnalystFindingsSchema, runDataAnalyst } from "@/ai/agents/data-analyst";
import type { ToolContext } from "@/ai/tools/context";
import { db } from "@/db";
import { organizations } from "@/db/schema";

async function main() {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "orqestra-demo"))
    .limit(1);
  if (!org) throw new Error("Demo org not found  run `npm run db:seed` first.");

  const ctx: ToolContext = { organizationId: org.id, userId: "smoke" };
  const objective =
    "Analyze our customers and identify high-value customers who are at risk of churn. Report the exact totals (customers analyzed, high-risk, high-value at-risk) and the recovery opportunity.";

  console.log("Running Data Analyst agent (live)…\n");
  const result = await runDataAnalyst(ctx, objective);

  console.log("── Tool calls ──");
  for (const t of result.toolCalls) console.log(`  • ${t.tool}(${JSON.stringify(t.input)})`);
  console.log("\n── Usage ──");
  console.log(`  input=${result.usage.inputTokens} output=${result.usage.outputTokens} tokens`);
  console.log("\n── Findings ──");
  console.log("  summary:", result.findings.summary);
  console.log("  metrics:", result.findings.metrics);
  console.log("  highlighted (first 3):");
  for (const c of result.findings.highlightedCustomers.slice(0, 3)) {
    console.log(
      `    - ${c.externalRef} ${c.name} | $${c.mrr}/mo | usage ${c.usageChangePct}% | ${c.reason}`,
    );
  }
  console.log("  recommendations:", result.findings.recommendations);

  // Assertions
  dataAnalystFindingsSchema.parse(result.findings);
  const madeToolCall = result.toolCalls.length >= 1;
  const metricsCorrect = result.findings.metrics.customersAnalyzed === 2481;

  console.log("\n── Checks ──");
  console.log(`  schema-valid findings: ✓`);
  console.log(`  made ≥1 tool call: ${madeToolCall ? "✓" : "✗"}`);
  console.log(
    `  customersAnalyzed === 2481: ${metricsCorrect ? "✓" : `✗ (got ${result.findings.metrics.customersAnalyzed})`}`,
  );

  if (madeToolCall && metricsCorrect) {
    console.log("\n✅ SMOKE PASS");
  } else {
    console.log("\n⚠️  SMOKE completed but not all assertions met (LLM nondeterminism).");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("✗ agent smoke failed:", err);
  process.exit(1);
});
