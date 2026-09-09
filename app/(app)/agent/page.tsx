import { AgentWorkspace } from "@/components/agent/agent-workspace";
import { getTemplate } from "@/config/scenarios";

export const metadata = { title: "AI Agent" };

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { template } = await searchParams;
  const initialObjective = template ? getTemplate(template)?.objective : undefined;

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col">
      <AgentWorkspace initialObjective={initialObjective} />
    </div>
  );
}
