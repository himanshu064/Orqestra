import { pgEnum } from "drizzle-orm/pg-core";

// --- Identity -----------------------------------------------------------------
export const userRole = pgEnum("user_role", ["admin", "manager", "analyst", "employee"]);

// --- Agent execution ----------------------------------------------------------
export const runStatus = pgEnum("run_status", [
  "pending",
  "planning",
  "running",
  "waiting_for_approval",
  "completed",
  "failed",
  "cancelled",
]);

export const agentKey = pgEnum("agent_key", [
  "manager",
  "data_analyst",
  "research",
  "communication",
]);

export const stepType = pgEnum("step_type", [
  "plan",
  "delegate",
  "tool_call",
  "message",
  "review",
  "final",
]);

/** Generic execution status for steps and tool calls. */
export const execStatus = pgEnum("exec_status", ["pending", "running", "success", "error"]);

// --- Approvals ----------------------------------------------------------------
export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "executed",
  "failed",
  // Claimed for execution (at-most-once); transitions to executed/failed once the side-effect runs.
  "executing",
]);

// --- Platform -----------------------------------------------------------------
export const actorType = pgEnum("actor_type", ["user", "agent", "system"]);

// --- Knowledge / RAG ----------------------------------------------------------
export const docStatus = pgEnum("doc_status", ["processing", "ready", "failed"]);

// --- Business data ------------------------------------------------------------
export const customerStatus = pgEnum("customer_status", [
  "active",
  "at_risk",
  "churned",
  "recovered",
]);

export const riskLevel = pgEnum("risk_level", ["low", "medium", "high"]);

export const invoiceStatus = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "overdue",
  "failed",
  "void",
]);

export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
]);

export const ticketStatus = pgEnum("ticket_status", ["open", "pending", "resolved", "closed"]);

// --- AI settings (BYO provider) ----------------------------------------------
export const aiProvider = pgEnum("ai_provider", ["openai", "anthropic", "google"]);
