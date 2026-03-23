#!/usr/bin/env python3
import json

with open('/root/.openclaw/openclaw.json', 'r') as f:
    cfg = json.load(f)

# Update agent model routing per 4-tier spec
agents = {a['id']: a for a in cfg['agents']['list']}

# COO: Default Gemini 3.0, complex → 3.1 Pro
agents['lex-coo']['model'] = {
    "primary": "google/gemini-3-pro-preview",
    "fallbacks": [
        "google/gemini-3.1-pro-preview",
        "zai/glm-5",
        "minimax/MiniMax-M2.5"
    ]
}

# Intake: GLM-5 (structured extraction), fallback MiniMax (updates)
agents['lex-intake']['model'] = {
    "primary": "zai/glm-5",
    "fallbacks": [
        "minimax/MiniMax-M2.5",
        "google/gemini-3-pro-preview",
        "google/gemini-3.1-pro-preview"
    ]
}

# Research: GLM-5 (standard), escalate to 3.1 Pro (deep)
agents['lex-research']['model'] = {
    "primary": "zai/glm-5",
    "fallbacks": [
        "google/gemini-3.1-pro-preview",
        "google/gemini-3-pro-preview",
        "minimax/MiniMax-M2.5"
    ]
}

# Draft: GLM-5 (templates), escalate to 3.1 Pro (complex)
agents['lex-draft']['model'] = {
    "primary": "zai/glm-5",
    "fallbacks": [
        "google/gemini-3.1-pro-preview",
        "google/gemini-3-pro-preview",
        "minimax/MiniMax-M2.5"
    ]
}

# Control: MiniMax (simple checklists), GLM-5 (complex cross-ref)
agents['lex-control']['model'] = {
    "primary": "minimax/MiniMax-M2.5",
    "fallbacks": [
        "zai/glm-5",
        "google/gemini-3-pro-preview"
    ]
}

# Memory: MiniMax (indexing/tagging), GLM-5 (synthesis)
agents['lex-memory']['model'] = {
    "primary": "minimax/MiniMax-M2.5",
    "fallbacks": [
        "zai/glm-5",
        "google/gemini-3-pro-preview"
    ]
}

# Update heartbeats per daily cycle
agents['lex-coo']['heartbeat'] = {
    "every": "30m",
    "target": "none",
    "prompt": "Sprawdz status systemu. Jesli jest 8:00-9:00 rano: wygeneruj DZIENNY BRIEF (nowe sprawy, terminy dzis, zablokowane, do review, eskalacje) i wyslij na Telegram. Jesli jest 20:00-21:00: wygeneruj wieczorny status (ukonczone dzis, w toku, terminy jutro). W innym czasie: sprawdz overdue tasks, ESCALATED items, blocked matters. Jesli nie ma nic do zrobienia — HEARTBEAT_OK."
}

agents['lex-intake']['heartbeat'] = {
    "every": "30m",
    "target": "none",
    "prompt": "Sprawdz czy sa nowe wiadomosci do przetworzenia (email, Telegram). Sprawdz case cards ze statusem needs_client_input — czy klient odpowiedzial. Jesli nie ma nic nowego — HEARTBEAT_OK."
}

agents['lex-research']['heartbeat'] = {
    "every": "30m",
    "target": "none",
    "prompt": "Sprawdz czy sa oczekujace zlecenia na analize prawna od @lex-coo. Sprawdz czy sa memos ze statusem IN_PROGRESS. Jesli nie ma nic do zrobienia — HEARTBEAT_OK."
}

agents['lex-draft']['heartbeat'] = {
    "every": "30m",
    "target": "none",
    "prompt": "Sprawdz czy sa oczekujace zlecenia na drafting od @lex-coo. Sprawdz dokumenty ze statusem BLOCKED — czy braki zostaly uzupelnione. Jesli nie ma nic do zrobienia — HEARTBEAT_OK."
}

agents['lex-control']['heartbeat'] = {
    "every": "30m",
    "target": "none",
    "prompt": "Sprawdz czy sa dokumenty oczekujace na compliance review od @lex-draft. Sprawdz dokumenty ze statusem NEEDS_REVIEW. Jesli nie ma nic do zrobienia — HEARTBEAT_OK."
}

agents['lex-memory']['heartbeat'] = {
    "every": "60m",
    "target": "none",
    "prompt": "Sprawdz czy sa ukonczone sprawy lub milestones do zarchiwizowania. Jesli jest 20:00-21:00: przejrzyj zakonczenia dnia, ekstrahuj precedent_capture entries. Jesli nie ma nic do zrobienia — HEARTBEAT_OK."
}

# Update defaults model aliases
cfg['agents']['defaults']['models'] = {
    "google/gemini-3.1-pro-preview": {"alias": "frontier"},
    "zai/glm-5": {"alias": "workhorse"},
    "google/gemini-3-pro-preview": {"alias": "balanced"},
    "minimax/MiniMax-M2.5": {"alias": "budget"},
    "zai/glm-4.7": {"alias": "fallback"}
}

cfg['agents']['defaults']['model'] = {
    "primary": "zai/glm-5",
    "fallbacks": ["minimax/MiniMax-M2.5", "google/gemini-3-pro-preview"]
}

# Rebuild list
cfg['agents']['list'] = [agents[aid] for aid in ['lex-coo', 'lex-intake', 'lex-research', 'lex-draft', 'lex-control', 'lex-memory']]

with open('/root/.openclaw/openclaw.json', 'w') as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)

print("Config updated successfully")
print("\nModel routing:")
for a in cfg['agents']['list']:
    print(f"  {a['id']}: primary={a['model']['primary']}, fallbacks={a['model']['fallbacks']}")
print("\nHeartbeats:")
for a in cfg['agents']['list']:
    print(f"  {a['id']}: every={a['heartbeat']['every']}")
