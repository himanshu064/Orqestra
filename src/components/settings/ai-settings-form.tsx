"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveSettingsAction, testConnectionAction, type ActionResult } from "@/actions/ai-settings";
import {
  AI_PROVIDERS,
  EMBEDDING_PROVIDERS,
  PROVIDER_CATALOG,
  defaultEmbeddingModel,
  type ProviderId,
} from "@/ai/models";
import { Database, KeyRound, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag } from "@/components/ui/tag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PublicAiSettings } from "@/services/ai-settings";

export function AiSettingsForm({ settings }: { settings: PublicAiSettings }) {
  const [provider, setProvider] = useState<ProviderId>(settings.provider ?? "anthropic");
  const [model, setModel] = useState<string>(
    settings.model ?? PROVIDER_CATALOG[settings.provider ?? "anthropic"].chat,
  );
  const [embeddingProvider, setEmbeddingProvider] = useState<ProviderId>(
    settings.embeddingProvider ?? "google",
  );

  const [saveState, saveAction, saving] = useActionState<ActionResult | undefined, FormData>(
    saveSettingsAction,
    undefined,
  );
  const [testing, startTest] = useTransition();

  useEffect(() => {
    if (!saveState) return;
    if (saveState.ok) toast.success(saveState.message);
    else toast.error(saveState.message);
  }, [saveState]);

  function onProviderChange(next: ProviderId) {
    setProvider(next);
    // Reset the model to the new provider's default for a sane starting point.
    setModel(PROVIDER_CATALOG[next].chat);
  }

  function runTest() {
    startTest(async () => {
      const result = await testConnectionAction();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  const catalog = PROVIDER_CATALOG[provider];

  return (
    <Card>
      <form action={saveAction}>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Sparkles className="size-4.5" />
              </span>
              <div>
                <CardTitle>AI Configuration</CardTitle>
                <CardDescription>Bring your own provider key.</CardDescription>
              </div>
            </div>
            {settings.hasKey ? (
              <Tag tone="emerald">Connected</Tag>
            ) : (
              <Tag tone="amber">Not configured</Tag>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Provider */}
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select
              name="provider"
              value={provider}
              onValueChange={(v) => onProviderChange(v as ProviderId)}
            >
              <SelectTrigger id="provider" className="w-full">
                <SelectValue placeholder="Select a provider">
                  {(value: string) =>
                    AI_PROVIDERS.find((p) => p.value === value)?.label ?? value
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              name="model"
              list="model-suggestions"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={catalog.chat}
              required
            />
            <datalist id="model-suggestions">
              {catalog.chatSuggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <p className="text-muted-foreground text-xs">
              Any model ID this provider supports. Suggestions shown; default is{" "}
              <code>{catalog.chat}</code>.
            </p>
          </div>

          {/* API key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API key</Label>
            <Input
              id="apiKey"
              name="apiKey"
              type="password"
              autoComplete="off"
              placeholder={
                settings.hasKey
                  ? `•••• ${settings.apiKeyLast4}  leave blank to keep`
                  : catalog.keyHint
              }
            />
            <p className="text-muted-foreground text-xs">
              {settings.hasKey
                ? "A key is saved. Enter a new one only to replace it."
                : catalog.keyHint}
            </p>
            <p className="text-muted-foreground/80 flex items-center gap-1.5 text-xs">
              <KeyRound className="size-3" />
              Encrypted at rest (AES-256) and never shown again.
            </p>
          </div>

          {/* Embeddings  Claude has no embeddings API, so RAG needs a dedicated provider/key. */}
          {provider === "anthropic" ? (
            <div className="border-border/60 space-y-4 rounded-lg border border-dashed p-4">
              <div className="flex items-start gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Database className="size-4" />
                </span>
                <div>
                  <div className="text-sm font-medium">Embeddings provider</div>
                  <div className="text-muted-foreground text-xs">
                    Claude has no embeddings API. Add an OpenAI or Google key to power Knowledge Base
                    search.
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="embeddingProvider">Provider</Label>
                <Select
                  name="embeddingProvider"
                  value={embeddingProvider}
                  onValueChange={(v) => setEmbeddingProvider(v as ProviderId)}
                >
                  <SelectTrigger id="embeddingProvider" className="w-full">
                    <SelectValue placeholder="Select a provider">
                      {(value: string) =>
                        EMBEDDING_PROVIDERS.find((p) => p.value === value)?.label ?? value
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EMBEDDING_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="embeddingApiKey">Embeddings API key</Label>
                <Input
                  id="embeddingApiKey"
                  name="embeddingApiKey"
                  type="password"
                  autoComplete="off"
                  placeholder={
                    settings.hasEmbeddingKey
                      ? `•••• ${settings.embeddingApiKeyLast4}  leave blank to keep`
                      : embeddingProvider === "google"
                        ? "Google AI Studio API key"
                        : "OpenAI API key (starts with sk-)"
                  }
                />
                <p className="text-muted-foreground text-xs">
                  Model: <code>{defaultEmbeddingModel(embeddingProvider)}</code> ·{" "}
                  {settings.hasEmbeddingKey ? "a key is saved" : "required for the Knowledge Base"}.
                </p>
              </div>
            </div>
          ) : null}

          {/* Embedding model: dedicated provider when Anthropic, else derived from the chat provider. */}
          <input
            type="hidden"
            name="embeddingModel"
            value={
              (provider === "anthropic"
                ? defaultEmbeddingModel(embeddingProvider)
                : defaultEmbeddingModel(provider)) ?? ""
            }
          />
        </CardContent>

        <CardFooter className="gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={runTest}
            disabled={testing || !settings.hasKey}
            title={settings.hasKey ? "Tests the saved configuration" : "Save a key first"}
          >
            {testing ? "Testing…" : "Test connection"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
