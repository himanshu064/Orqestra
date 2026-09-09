/**
 * Server-injected context for every tool call. Bound by the API layer from the authenticated
 * session  the model never supplies these, so a tool can only ever read its own org's data.
 */
export type ToolContext = {
  organizationId: string;
  userId: string;
};
