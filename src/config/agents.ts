import { BarChart3, Bot, Mail, Search, type LucideIcon } from "lucide-react";

import type { AgentKey } from "@/ai/tools/registry";

export const AGENT_META: Record<AgentKey, { label: string; short: string; icon: LucideIcon }> = {
  manager: { label: "Manager Agent", short: "Manager", icon: Bot },
  data_analyst: { label: "Data Analyst Agent", short: "Data Analyst", icon: BarChart3 },
  research: { label: "Research Agent", short: "Research", icon: Search },
  communication: { label: "Communication Agent", short: "Communication", icon: Mail },
};

export function agentLabel(key: AgentKey): string {
  return AGENT_META[key]?.label ?? key;
}
