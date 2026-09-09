# Orqestra

**An Agentic AI Operations Platform.** Give an AI _team_ a plain-English business objective - _"find high-value customers at risk of churn and prepare recovery outreach"_ - and a **Manager** agent plans it, **delegates** to specialist agents, they use real tools against your business data, and you get back a structured report plus any sensitive actions queued for **your approval**. Every run streams live and is fully traceable.

It's a **platform, not one hardcoded workflow**: the same machinery runs churn analysis, invoice recovery, sales reporting, and more - driven entirely by the objective you type.

---

## Highlights

- 🧠 **Multi-agent orchestration** - a Manager LLM delegates to **Data Analyst**, **Research**, and **Communication** specialists (agent-as-tool pattern), streamed live over SSE.
- 🔌 **Bring-your-own-key** - configure OpenAI, Anthropic, or Google in Settings; keys are **AES-256-GCM encrypted at rest**. Claude users can add a separate OpenAI/Google key just for embeddings.
- 📚 **RAG over pgvector** - upload PDF/DOCX/TXT → chunk → embed → semantic search, all inside the same Postgres (no separate vector DB).
- 🛡️ **Human-in-the-loop approvals** - sensitive actions (send email, create CRM task) are deferred for review, executed **at-most-once**, and written to an **immutable audit log**. Real email sending via Resend (mocked without a key).
- 🚦 **Guardrails** - hard ceilings on steps / tool-calls / agent-hops / per-tool timeout / per-run budget stop runaway runs with a clear reason.
- 📊 **Observability & cost** - full execution-trace viewer, per-model cost tracking (today / month), and an analytics dashboard.
- 🎬 **Demo scenarios & templates** - one-click Customer Recovery, Invoice Recovery, and Executive Reporting, plus a template picker.

---

## Tech stack

| Area      | Choice                                                             |
| --------- | ------------------------------------------------------------------ |
| Framework | Next.js 16 (App Router, Turbopack) · TypeScript · React 19         |
| UI        | Tailwind CSS v4 · shadcn / Base UI · lucide-react                  |
| AI        | Vercel AI SDK v7 (`generateText` / `generateObject` / `embedMany`) |
| Data      | Drizzle ORM · Neon serverless Postgres · **pgvector**              |
| Auth      | Auth.js (NextAuth v5) - Credentials + JWT, DAL-guard pattern       |
| Testing   | Vitest (unit + live-DB integration)                                |

---

## Getting started

### 1. Prerequisites

- Node 20+
- A [Neon](https://neon.tech) Postgres database (or any Postgres with the `vector` extension)
- An LLM provider API key (OpenAI, Anthropic, or Google) - entered in the app, not `.env`

### 2. Environment

Copy `.env.example` to `.env` and fill in:

```bash
DATABASE_URL=postgresql://…            # Neon connection string
AUTH_SECRET=…                          # openssl rand -base64 32
SETTINGS_ENCRYPTION_KEY=…              # openssl rand -base64 32  (encrypts provider keys)
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Optional - real outbound email (mocked if unset):
EMAIL_API_KEY=                         # Resend API key
EMAIL_FROM=                            # verified sender; defaults to onboarding@resend.dev
```

> LLM provider keys are **not** environment variables - they're entered in **Settings** and stored encrypted.

### 3. Install, migrate, seed

```bash
npm install
npm run db:migrate        # enables pgvector + applies all migrations
npm run db:seed           # ~2,481 demo customers, orders, invoices, tickets
npm run db:set-password -- manager@orqestra.demo 'Orqestra!2026'
npm run kb:seed           # optional: seed knowledge-base policy docs
npm run runs:seed         # optional: seed demo run history for the dashboards
```

Provision your LLM key without the UI (optional) by setting `AI_API_KEY` (+ `AI_PROVIDER`, `AI_MODEL`) in `.env` and running `npm run db:set-ai-key`.

### 4. Run

```bash
npm run dev
```

Open **http://localhost:3000** and sign in as the demo user:

```
manager@orqestra.demo  /  Orqestra!2026
```

Then go to **Settings** → add your provider key → **Test connection**, and head to **AI Agent** to run a scenario.

---

## Demo scenarios

Click a card on the Dashboard or a template on the AI Agent page:

| Scenario            | Agents                                    | What it shows                                  |
| ------------------- | ----------------------------------------- | ---------------------------------------------- |
| Customer Recovery   | Manager · Data Analyst · Research · Comms | 42 high-value accounts at risk · $184,500 ARR  |
| Invoice Recovery    | Manager · Data Analyst · Research · Comms | Overdue invoices > $5,000 · drafts + approvals |
| Executive Reporting | Manager · Data Analyst · Research         | Quarterly sales performance summary            |

Verify the demo data is compelling before a demo:

```bash
npm run scenarios:check
```

---

## Scripts

| Script                    | Purpose                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `dev` / `build` / `start` | Next.js dev / production build / serve                         |
| `typecheck` / `lint`      | `tsc --noEmit` / ESLint                                        |
| `test` / `test:run`       | Vitest (watch / once)                                          |
| `db:generate`             | Generate a Drizzle migration from schema changes               |
| `db:migrate`              | Apply migrations (enables pgvector first)                      |
| `db:studio`               | Drizzle Studio                                                 |
| `db:seed`                 | Seed business data (deterministic, idempotent)                 |
| `db:set-password`         | Set a user's password: `-- <email> <password>`                 |
| `db:set-ai-key`           | Provision the org's encrypted provider key from `.env`         |
| `kb:seed` / `runs:seed`   | Seed knowledge base / demo run history                         |
| `scenarios:check`         | Verify each demo scenario has compelling data                  |
| `*:smoke`                 | Live smoke tests (agent, run, rag, research, comms, guardrail) |

---

## Project structure

```
app/(app)/            Guarded pages (dashboard, agent, tasks, approvals, knowledge, activity, analytics, audit, settings)
app/api/              SSE agent stream, auth, documents
src/ai/               Agents, tools, provider layer, guardrails, prompts, pricing, events
src/services/         Business logic (runs, analytics, approvals, run-recorder, documents, email, audit)
src/db/schema/        Drizzle schema (20 tables) + migrations in /drizzle
src/components/        UI (ui/ primitives, runs/, agent/, approvals/, audit/, knowledge/, settings/, layout/, charts/)
src/lib/ · src/config/ Helpers (cost, format, status, rate-limit, errors) · scenarios, actions, nav
scripts/              Migrate / seed / smoke-test scripts
```

---

## How a run works

1. `POST /api/agent` opens an **SSE** stream.
2. A **RunRecorder** persists the trace (`agent_runs` / `agent_steps` / `tool_calls`) **and** emits live events.
3. The **Manager** plans and delegates; specialists call org-scoped tools against Postgres.
4. Sensitive actions create **pending approvals** (never auto-executed) and surface in the UI.
5. The Manager consolidates a **structured report**; the browser folds the event stream into live UI.

The LLM never touches the database or keys directly - it can only call **validated, per-organization tools**; sensitive actions require your approval; audit logs are immutable; and guardrails cap runaway loops.

---

## Deployment (Vercel)

1. Push to GitHub and import the repo in Vercel.
2. Create a **production** Neon database; run `db:migrate` + `db:seed` against it.
3. Set the env vars from `.env` in the Vercel project.
4. Use the **Pro** plan if you need long agent runs - `app/api/agent` sets `maxDuration = 300` (Hobby caps at 60s).
5. Configure your provider key in **Settings** on the deployed instance and run a smoke test.

> The built-in rate limiting is in-memory (per-instance) - for multi-instance production, back it with Redis.
