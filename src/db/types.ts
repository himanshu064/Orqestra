// Inferred row types for select/insert across the schema.
import type {
  agentMessages,
  agentRuns,
  agentSteps,
  agents,
  aiSettings,
  approvals,
  auditLogs,
  customerEvents,
  customers,
  documentChunks,
  documents,
  invoices,
  notifications,
  orders,
  organizations,
  subscriptions,
  supportTickets,
  tasks,
  toolCalls,
  users,
} from "./schema";

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;

export type AgentStep = typeof agentSteps.$inferSelect;
export type NewAgentStep = typeof agentSteps.$inferInsert;

export type AgentMessage = typeof agentMessages.$inferSelect;
export type NewAgentMessage = typeof agentMessages.$inferInsert;

export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type SupportTicket = typeof supportTickets.$inferSelect;
export type NewSupportTicket = typeof supportTickets.$inferInsert;

export type CustomerEvent = typeof customerEvents.$inferSelect;
export type NewCustomerEvent = typeof customerEvents.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type AiSettings = typeof aiSettings.$inferSelect;
export type NewAiSettings = typeof aiSettings.$inferInsert;
