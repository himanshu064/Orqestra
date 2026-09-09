import { requireUser } from "@/auth/dal";
import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { getAiSettings } from "@/services/ai-settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getAiSettings(user.organizationId);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <p className="text-muted-foreground text-sm">
        Configure the AI provider that powers your agents.
      </p>

      <AiSettingsForm settings={settings} />
    </div>
  );
}
