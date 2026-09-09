import {
  LayoutDashboard,
  Bot,
  ListChecks,
  ShieldCheck,
  BookOpen,
  Activity,
  BarChart3,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
};

/**
 * Single source of truth for the primary navigation (requirements §43).
 * Used by the sidebar and to resolve the current page title in the top bar.
 */
export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "High-level overview of agent operations.",
  },
  {
    title: "AI Agent",
    href: "/agent",
    icon: Bot,
    description: "Give the AI team a business objective.",
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: ListChecks,
    description: "Every request becomes a tracked agent task.",
  },
  {
    title: "Approvals",
    href: "/approvals",
    icon: ShieldCheck,
    description: "Review and approve sensitive actions.",
  },
  {
    title: "Knowledge Base",
    href: "/knowledge",
    icon: BookOpen,
    description: "Company documents the agents can search.",
  },
  {
    title: "Activity",
    href: "/activity",
    icon: Activity,
    description: "Full history and execution traces of runs.",
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Metrics, performance, and cost.",
  },
  {
    title: "Audit Log",
    href: "/audit",
    icon: ScrollText,
    description: "Immutable record of every important action.",
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "AI configuration, integrations, and security.",
  },
];

/** Resolve the nav item whose route matches the given pathname. */
export function getNavItem(pathname: string): NavItem | undefined {
  return navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
