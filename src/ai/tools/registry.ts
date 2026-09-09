import type { ToolSet } from "ai";

import { agentKey } from "@/db/schema";

import { createAnalyticsTools } from "./analytics-tools";
import type { ToolContext } from "./context";
import { createCustomerTools } from "./customer-tools";
import { createResearchTools } from "./research-tools";
import { createSalesTools } from "./sales-tools";
import { createSupportTools } from "./support-tools";

export type AgentKey = (typeof agentKey.enumValues)[number];

/** Data Analyst's full toolset (§9). */
export function buildDataAnalystTools(ctx: ToolContext): ToolSet {
  return {
    ...createCustomerTools(ctx),
    ...createSalesTools(ctx),
    ...createSupportTools(ctx),
    ...createAnalyticsTools(ctx),
  };
}

/** Research Agent's toolset (§10). */
export function buildResearchTools(ctx: ToolContext): ToolSet {
  return createResearchTools(ctx);
}

/**
 * Return only the tools an agent is permitted to use (§30). Manager/Research/Communication
 * toolsets are wired in later phases; today only the Data Analyst has tools.
 */
export function buildToolset(ctx: ToolContext, agent: AgentKey): ToolSet {
  switch (agent) {
    case "data_analyst":
      return buildDataAnalystTools(ctx);
    case "research":
      return buildResearchTools(ctx);
    case "manager":
    case "communication":
      return {};
  }
}
