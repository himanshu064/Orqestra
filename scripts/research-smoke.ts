import "dotenv/config";

import { eq } from "drizzle-orm";

import { researchFindingsSchema, runResearch } from "@/ai/agents/research";
import type { ToolContext } from "@/ai/tools/context";
import { db } from "@/db";
import { organizations } from "@/db/schema";

async function main() {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, "orqestra-demo"))
    .limit(1);
  if (!org) throw new Error("Demo org not found.");

  const ctx: ToolContext = { organizationId: org.id, userId: "smoke" };
  const objective = "What is our refund policy for enterprise customers? Cite the source.";

  console.log("Running Research agent (live)…\n");
  const result = await runResearch(ctx, objective);

  console.log("tool calls:", result.toolCalls.map((t) => t.tool).join(", "));
  console.log("summary:", result.findings.summary);
  console.log("sources:", result.findings.sources);

  researchFindingsSchema.parse(result.findings);
  const citedEnterprise = result.findings.sources.some((s) =>
    s.title.toLowerCase().includes("enterprise"),
  );
  const ok = result.toolCalls.length >= 1 && citedEnterprise;
  console.log(ok ? "\n✅ RESEARCH SMOKE PASS" : "\n⚠️  completed but Enterprise source not cited");
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error("✗ research smoke failed:", err);
  process.exit(1);
});
