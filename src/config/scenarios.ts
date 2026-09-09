import {
  FileText,
  HeartHandshake,
  ReceiptText,
  Telescope,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import type { AgentKey } from "@/ai/tools/registry";

/**
 * Agent templates / demo scenarios (§41, §42). A single source of truth for the preloadable
 * tasks surfaced on the Agent console and Dashboard. `featured` marks the three polished
 * end-to-end scenarios from §41 (Customer Recovery, Invoice Recovery, Business Intelligence).
 */
export type ScenarioTemplate = {
  id: string;
  title: string;
  description: string;
  /** The task text loaded into the composer when the template is chosen. */
  objective: string;
  agents: AgentKey[];
  icon: LucideIcon;
  featured?: boolean;
};

export const TEMPLATES: ScenarioTemplate[] = [
  {
    id: "customer-recovery",
    title: "Customer Recovery",
    description: "Find high-value accounts at risk of churn and prepare recovery campaigns.",
    objective:
      "Analyze our high-value customers at risk of churn and prepare recovery campaigns for the accounts with the largest revenue at stake.",
    agents: ["manager", "data_analyst", "research", "communication"],
    icon: HeartHandshake,
    featured: true,
  },
  {
    id: "invoice-recovery",
    title: "Invoice Recovery",
    description: "Chase overdue invoices above $5,000 with tailored follow-ups.",
    objective:
      "Find overdue invoices above $5,000, analyze each customer's history, and prepare follow-up outreach to recover the outstanding balances.",
    agents: ["manager", "data_analyst", "research", "communication"],
    icon: ReceiptText,
    featured: true,
  },
  {
    id: "sales-analysis",
    title: "Sales Analysis",
    description: "Break down this quarter's revenue by plan and segment.",
    objective:
      "Analyze this quarter's sales performance and break down revenue by plan and customer segment, highlighting the biggest movers.",
    agents: ["manager", "data_analyst"],
    icon: TrendingUp,
  },
  {
    id: "competitor-research",
    title: "Competitor Research",
    description: "Summarize competitor moves and what they mean for us.",
    objective:
      "Research recent competitor pricing and product moves and summarize the implications for our positioning and go-to-market.",
    agents: ["manager", "research"],
    icon: Telescope,
  },
  {
    id: "executive-reporting",
    title: "Executive Reporting",
    description: "Turn quarterly performance into an executive summary.",
    objective:
      "Analyze this quarter's sales performance and create a concise executive summary with the key metrics, wins, and risks.",
    agents: ["manager", "data_analyst", "research"],
    icon: FileText,
    featured: true,
  },
];

export function getTemplate(id: string): ScenarioTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export const FEATURED_TEMPLATES = TEMPLATES.filter((t) => t.featured);
