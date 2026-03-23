import { v4 as uuidv4 } from 'uuid';
import { getDb, closeDb } from './index';

const LEX_COO_SOUL = `# Lex COO — Orchestrator Kancelarii Prawnej

Główny koordynator operacyjny. Klasyfikuje sprawy, deleguje do właściwego agenta, monitoruje postęp.

## Delegacja
- Niejasny input → lex-intake
- Pytanie prawne → lex-research
- Tworzenie dokumentu → lex-draft
- Sprawdzenie formalne → lex-control
- Baza wiedzy → lex-memory

## Model: GLM-5 (reasoning)
`;

const LEX_INTAKE_SOUL = `# Lex Intake — Specjalista od porządkowania chaosu

Zamienia chaotyczne wiadomości klientów w uporządkowane Karty Spraw.
Wyciąga fakty, buduje chronologię, listuje luki informacyjne.

## Model: MiniMax M2.5 (szybki)
`;

const LEX_RESEARCH_SOUL = `# Lex Research — Analityk Prawny

Produkuje Legal Memo z analizą prawną, argumentami za/przeciw, ryzykami i rekomendacjami.
Tryby: SZYBKI / STANDARD / DEEP.

## Model: GLM-5 (reasoning)
`;

const LEX_DRAFT_SOUL = `# Lex Draft — Twórca Dokumentów Prawnych

Tworzy drafty dokumentów: wezwania, umowy, NDA, pozwy, pisma.
Używa placeholderów zamiast zgadywania. Każdy dokument = DRAFT.

## Model: GLM-5 (reasoning)
`;

const LEX_CONTROL_SOUL = `# Lex Control — Kontroler Jakości

Weryfikuje kompletność formalną dokumentów. Zero tolerancji dla braków.
Checklisty per typ dokumentu. Status: BLOCKED / WYMAGA POPRAWEK / READY.

## Model: GLM-5 (reasoning)
`;

const LEX_MEMORY_SOUL = `# Lex Memory — Kurator Bazy Wiedzy

Archiwista kancelarii. Zapisuje szablony, precedensy, lessons learned.
Taguje, wersjonuje, nigdy nie usuwa — oznacza jako archiwalne.

## Model: MiniMax M2.5 (szybki)
`;

async function seed() {
  const db = getDb();

  const existingCount = (db.prepare('SELECT COUNT(*) as c FROM agents').get() as { c: number }).c;
  if (existingCount > 0) {
    console.log(`[Seed] Skipping - ${existingCount} agents already exist`);
    closeDb();
    return;
  }

  console.log('Seeding Legal Team database...');
  const now = new Date().toISOString();

  const businessId = 'default';
  db.prepare(
    `INSERT OR IGNORE INTO businesses (id, name, description, created_at) VALUES (?, ?, ?, ?)`
  ).run(businessId, 'Kancelaria Prawna', 'Legal AI Team — system agentów prawnych', now);

  const defaultWorkspaceId = 'default';
  db.prepare(
    `INSERT OR REPLACE INTO workspaces (id, name, slug, description, icon) VALUES (?, ?, ?, ?, ?)`
  ).run(defaultWorkspaceId, 'Kancelaria Prawna', 'kancelaria', 'Intake → Research → Draft → Control → Memory', '⚖️');

  const cooId = uuidv4();
  db.prepare(
    `INSERT INTO agents (id, name, role, description, avatar_emoji, status, is_master, workspace_id, soul_md, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(cooId, 'Lex COO', 'Chief Operating Officer', 'Orchestrator — klasyfikuje sprawy, deleguje do agentów, monitoruje postęp, raportuje.', '⚖️', 'standby', 1, defaultWorkspaceId, LEX_COO_SOUL, now, now);

  const intakeId = uuidv4();
  db.prepare(
    `INSERT INTO agents (id, name, role, description, avatar_emoji, status, is_master, workspace_id, soul_md, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(intakeId, 'Lex Intake', 'Case Intake Specialist', 'Porządkuje chaos — zamienia wiadomości klientów w uporządkowane Karty Spraw.', '📋', 'standby', 0, defaultWorkspaceId, LEX_INTAKE_SOUL, now, now);

  const researchId = uuidv4();
  db.prepare(
    `INSERT INTO agents (id, name, role, description, avatar_emoji, status, is_master, workspace_id, soul_md, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(researchId, 'Lex Research', 'Legal Research Analyst', 'Analityk prawny — produkuje Legal Memo z przepisami, argumentami, ryzykami.', '🔍', 'standby', 0, defaultWorkspaceId, LEX_RESEARCH_SOUL, now, now);

  const draftId = uuidv4();
  db.prepare(
    `INSERT INTO agents (id, name, role, description, avatar_emoji, status, is_master, workspace_id, soul_md, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(draftId, 'Lex Draft', 'Document Drafting Specialist', 'Twórca dokumentów — wezwania, umowy, NDA, pozwy. Zawsze DRAFT z placeholderami.', '✍️', 'standby', 0, defaultWorkspaceId, LEX_DRAFT_SOUL, now, now);

  const controlId = uuidv4();
  db.prepare(
    `INSERT INTO agents (id, name, role, description, avatar_emoji, status, is_master, workspace_id, soul_md, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(controlId, 'Lex Control', 'Quality & Compliance Controller', 'Kontroler jakości — weryfikuje kompletność formalną, checklisty, spójność.', '🛡️', 'standby', 0, defaultWorkspaceId, LEX_CONTROL_SOUL, now, now);

  const memoryId = uuidv4();
  db.prepare(
    `INSERT INTO agents (id, name, role, description, avatar_emoji, status, is_master, workspace_id, soul_md, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(memoryId, 'Lex Memory', 'Knowledge Base Curator', 'Archiwista — szablony, precedensy, lessons learned. Taguje i wersjonuje.', '🧠', 'standby', 0, defaultWorkspaceId, LEX_MEMORY_SOUL, now, now);

  const agentIds = [cooId, intakeId, researchId, draftId, controlId, memoryId];

  const teamConvoId = uuidv4();
  db.prepare(
    `INSERT INTO conversations (id, title, type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(teamConvoId, 'Legal Team', 'group', now, now);

  for (const agentId of agentIds) {
    db.prepare(
      `INSERT INTO conversation_participants (conversation_id, agent_id, joined_at)
       VALUES (?, ?, ?)`
    ).run(teamConvoId, agentId, now);
  }

  const events = [
    { type: 'system', message: 'Legal AI Team zainicjalizowany' },
    { type: 'agent_joined', agentId: cooId, message: 'Lex COO dolaczyl jako orchestrator' },
    { type: 'agent_joined', agentId: intakeId, message: 'Lex Intake dolaczyl — intake spraw' },
    { type: 'agent_joined', agentId: researchId, message: 'Lex Research dolaczyl — analiza prawna' },
    { type: 'agent_joined', agentId: draftId, message: 'Lex Draft dolaczyl — tworzenie dokumentow' },
    { type: 'agent_joined', agentId: controlId, message: 'Lex Control dolaczyl — kontrola jakosci' },
    { type: 'agent_joined', agentId: memoryId, message: 'Lex Memory dolaczyl — baza wiedzy' },
    { type: 'system', message: 'Zespol prawny gotowy. Workflow: Intake → Research → Draft → Control → Memory.' },
  ];

  for (const event of events) {
    db.prepare(
      `INSERT INTO events (id, type, agent_id, message, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(uuidv4(), event.type, (event as { agentId?: string }).agentId || null, event.message, now);
  }

  db.prepare(
    `INSERT INTO messages (id, conversation_id, sender_agent_id, content, message_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    uuidv4(),
    teamConvoId,
    cooId,
    "Zespol prawny na pozycjach. Intake — porzadkowanie spraw. Research — analiza prawna. Draft — dokumenty. Control — weryfikacja. Memory — baza wiedzy. Gotowi do pracy.",
    'text',
    now
  );

  console.log('Legal Team database seeded:');
  console.log(`  Lex COO (orchestrator): ${cooId}`);
  console.log(`  Lex Intake (intake): ${intakeId}`);
  console.log(`  Lex Research (research): ${researchId}`);
  console.log(`  Lex Draft (drafting): ${draftId}`);
  console.log(`  Lex Control (compliance): ${controlId}`);
  console.log(`  Lex Memory (knowledge): ${memoryId}`);

  closeDb();
}

seed().catch(console.error);
