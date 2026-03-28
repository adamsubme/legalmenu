# Legal AI Agent Team

Autonomous legal operations system built on [OpenClaw](https://openclaw.com). Six specialized AI agents collaborate to handle legal matters end-to-end — from client intake through research, document drafting, quality control, to knowledge archival.

Running on a Hetzner VPS. Dashboard at **lex.protocolspring.com**.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        VPS (Hetzner)                        │
│                                                             │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │  OpenClaw Gateway │◄──►│  Mission Control (PM2)       │   │
│  │  (systemd native) │    │  Next.js 14 + SQLite         │   │
│  │  port 18789       │    │  port 3000                   │   │
│  └────────┬─────────┘    └──────────────────────────────┘   │
│           │                                                  │
│  ┌────────▼─────────────────────────────────────────────┐   │
│  │              6 Legal Agents (autonomous)              │   │
│  │  ⚖️ COO → 📋 Intake → 🔍 Research → ✍️ Draft        │   │
│  │                          → 🛡️ Control → 🧠 Memory    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐              │
│  │ Telegram │  │  Gmail   │  │ Google Drive  │              │
│  │   Bot    │  │  (gog)   │  │  Docs/Sheets  │              │
│  └──────────┘  └──────────┘  └──────────────┘              │
│                                                             │
│  ┌───────────────────────────────────────────┐              │
│  │  OpenAI Vector Store (65 MiCA/ESMA docs)  │              │
│  │  vs_69c069ceadc88191bbff088737bd11c3       │              │
│  └───────────────────────────────────────────┘              │
│                                                             │
│  ┌───────────┐                                              │
│  │   Caddy   │ ← HTTPS reverse proxy (lex.protocolspring)  │
│  └───────────┘                                              │
└─────────────────────────────────────────────────────────────┘
```

## Agents

### ⚖️ Lex COO — Chief Operating Officer
- **Role**: Coordinator. Receives all tasks, classifies them, delegates to the right agent, monitors progress.
- **Does NOT**: write documents, do research, or communicate with clients directly.
- **Model**: Gemini 3 Pro → Gemini 3.1 Pro → GLM-5 → MiniMax M2.5
- **Subagents**: can delegate to all five other agents.
- **Heartbeat**: every 30min. Morning brief (8-9 AM), evening status (8-9 PM), overdue/blocked checks otherwise.

### 📋 Lex Intake — Case Intake Specialist
- **Role**: Turns chaotic client input (emails, Telegram messages) into structured case cards.
- **Extracts**: parties, facts, chronology, legal questions, information gaps.
- **Output**: standardized case card with tagged fields.
- **Model**: GLM-5 → MiniMax → Gemini 3 Pro → Gemini 3.1 Pro

### 🔍 Lex Research — Legal Research Analyst
- **Role**: Deep legal analysis. Finds applicable laws, regulations, precedents.
- **Specialization**: MiCA/crypto regulation, EU regulatory framework, Polish commercial law.
- **Tools**: OpenAI Vector Store (65 MiCA/ESMA/EBA documents), web search, Gemini.
- **Output**: research memos with confidence levels (CERTAIN / PROBABLE / UNCERTAIN / DISPUTED).
- **Model**: GLM-5 → Gemini 3.1 Pro → Gemini 3 Pro → MiniMax

### ✍️ Lex Draft — Legal Document Drafter
- **Role**: Creates legal documents — contracts, NDAs, regulations, letters, corporate docs.
- **Rules**: never marks anything as "final" (always DRAFT), uses `[TO COMPLETE: ...]` placeholders for unknowns.
- **Output**: Google Docs on Drive, tagged as DRAFT.
- **Model**: GLM-5 → Gemini 3.1 Pro → Gemini 3 Pro → MiniMax

### 🛡️ Lex Control — Quality & Compliance Controller
- **Role**: Formal review. Checks for missing dates, signatures, attachments, internal consistency.
- **Approach**: zero tolerance for formal deficiencies. A document is either ready or it's not.
- **Does NOT**: fix substantive legal content — sends it back to Research or Draft.
- **Model**: MiniMax M2.5 → GLM-5 → Gemini 3 Pro

### 🧠 Lex Memory — Knowledge Base Curator
- **Role**: Archives completed matters, extracts precedents, maintains templates.
- **Rules**: only stores verified, human-approved content. Tags everything. Never deletes — marks as ARCHIVAL.
- **Output**: LESSONS.md files, vector store entries.
- **Model**: MiniMax M2.5 → GLM-5 → Gemini 3 Pro
- **Heartbeat**: every 60min. Evening precedent extraction.

## Agent Collaboration Flow

```
Client message (Telegram/Email)
        │
        ▼
   ⚖️ Lex COO ─── classifies, routes
        │
        ├──► 📋 Lex Intake ─── structures facts, identifies gaps
        │         │
        │         ▼ (structured case card)
        │
        ├──► 🔍 Lex Research ─── legal analysis, finds applicable law
        │         │
        │         ▼ (research memo)
        │
        ├──► ✍️ Lex Draft ─── creates document on Google Drive
        │         │
        │         ▼ (DRAFT document)
        │
        ├──► 🛡️ Lex Control ─── formal QA checklist
        │         │
        │         ├── PASS → back to COO → human review → DONE
        │         └── FAIL → back to Draft with issues list
        │
        └──► 🧠 Lex Memory ─── archives, extracts lessons
```

### Safety Rules (all agents)
- **No external communication** without human approval (`APPROVED_BY_HUMAN` status required).
- **Prompt injection resistance** — client file contents are treated as untrusted data, never as instructions.
- **Escalation triggers**: criminal matters, disputes > 100k PLN, deadlines < 48h, cross-border, M&A, documents requiring signature.
- **No guessing** — unknown facts are listed as gaps, never fabricated.

## Mission Control Dashboard

Web UI for managing the legal agent team. Built with Next.js 14, SQLite, Tailwind CSS.

**Features:**
- **Kanban board** — drag-and-drop case management with 5 statuses + sub-statuses (waiting for client, waiting for documents, internal block).
- **Case detail** — editable title/description, visual workflow timeline, agent chat, document uploads, deliverables.
- **Agent management** — edit agent identity files (IDENTITY.md, SOUL.md), model configuration, saved lessons.
- **Knowledge base** — semantic search across OpenAI Vector Store, file upload, CRUD.
- **Communications** — global inbox for email and Telegram messages.
- **Escalations** — blocked cases grouped by reason, with unblock actions.
- **Costs** — real usage data parsed from OpenClaw gateway logs.
- **Auth** — cookie-based session with HMAC-SHA256.

### New case form
Supports case types: Analysis, Contract, Regulation, Procedure/Checklist, Letter, Lawsuit, Corporate, Negotiation, Due Diligence. File upload and link attachment at creation time.

## Infrastructure

| Component | Technology | Location |
|---|---|---|
| AI Gateway | OpenClaw 2026.3.13 | systemd (`openclaw-legal.service`) |
| Dashboard | Next.js 14 + SQLite | PM2 process, port 3000 |
| Reverse Proxy | Caddy | HTTPS at `lex.protocolspring.com` |
| LLM Providers | Google Gemini, Z.AI GLM, MiniMax | API |
| Vector Store | OpenAI | 65 MiCA/ESMA/EBA documents |
| Communication | Telegram Bot, Gmail (via gog CLI) | |
| File Storage | Google Drive | OAuth2 (`adam@protocolspring.com`) |
| VPS | Hetzner (8GB RAM, Helsinki) | `89.167.36.59` |

### Model Stack (4-tier fallback)
1. **Frontier**: `google/gemini-3.1-pro-preview` — complex analysis, gap finding
2. **Workhorse**: `zai/glm-5` — daily operations, default primary
3. **Balanced**: `google/gemini-3-pro-preview` — general fallback
4. **Budget**: `minimax/MiniMax-M2.5` — high-volume, cost-effective tasks

### Skills (available to all agents)
`gemini` · `gog` (Google Workspace) · `oracle` (vector search) · `nano-pdf` · `browser` · `notion` · `document-convert` · `session-logs` · `summarize`

## Repo Structure

```
├── agents-legal/           # Agent configuration (6 agents)
│   ├── lex-coo/agent/      #   IDENTITY.md, SOUL.md, AGENTS.md, TOOLS.md, BOOTSTRAP.md
│   ├── lex-intake/agent/
│   ├── lex-research/agent/
│   ├── lex-draft/agent/
│   ├── lex-control/agent/
│   └── lex-memory/agent/
├── dashboard/              # Mission Control (Next.js source)
│   ├── src/app/            #   Pages + API routes
│   ├── src/components/     #   UI components
│   ├── src/lib/            #   DB, types, utils, dispatch, OpenClaw client
│   └── Dockerfile
├── openclaw.json           # Gateway config (API keys as ${ENV_VAR} refs)
└── README.md
```

## Deployment

### Current Setup (PM2)

Dashboard runs directly on the host via PM2 (not in Docker):

```bash
# Navigate to dashboard
cd /root/mission-control/dashboard

# Install dependencies
npm ci --legacy-peer-deps

# Build
npm run build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
```

Environment variables must be set in `/etc/environment.d/mission-control.conf` or via systemd:

```bash
# Example /etc/environment.d/mission-control.conf
AGENT_API_KEY=your-agent-api-key
MC_LOGIN_PASSWORD=your-secure-password
AUTH_PASSWORD=your-secure-password
OPENCLAW_GATEWAY_TOKEN=your-gateway-token
OPENAI_API_KEY=sk-proj-your-key
TG_BOT_LEX_TOKEN=your-telegram-bot-token    # Optional
TG_BOT_INTAKE_TOKEN=your-intake-bot-token   # Optional
```

OpenClaw gateway runs as a native systemd service (`openclaw-legal.service`).

### Docker (Alternative)

A Dockerfile exists for optional Docker-based deployment. Currently **not used** in production.

```bash
cd dashboard
docker build -t mission-control .
docker run -d --name mission-control \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /root/mission-control-data/mission-control.db:/app/mission-control.db \
  -v /root/case-attachments:/app/attachments \
  -v /root/.openclaw:/root/.openclaw:rw \
  --add-host=host.docker.internal:host-gateway \
  -e OPENCLAW_GATEWAY_URL=ws://host.docker.internal:18789 \
  -e OPENCLAW_GATEWAY_TOKEN=$GATEWAY_TOKEN \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e AUTH_USERNAME=Admin \
  -e AUTH_PASSWORD=$AUTH_PASSWORD \
  -e SESSION_SECRET=$SESSION_SECRET \
  mission-control
```

## License

Private repository. All rights reserved.
