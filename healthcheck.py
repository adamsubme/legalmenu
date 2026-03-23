#!/usr/bin/env python3
"""
OpenClaw Venture Studio — Health Check
Run inside the Docker container or via: docker exec openclaw-openclaw-gateway-1 python3 /home/node/.openclaw/healthcheck.py
"""

import json
import os
import subprocess
import sys
import urllib.request
import urllib.error

PASS = "✅"
FAIL = "❌"
WARN = "⚠️"
results = []

def log(status, category, test, detail=""):
    results.append((status, category, test, detail))
    print(f"  {status} [{category}] {test}" + (f" — {detail}" if detail else ""))

def run(cmd, timeout=30):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout.strip(), r.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "TIMEOUT"
    except Exception as e:
        return -1, "", str(e)

UA = {"User-Agent": "OpenClaw-HealthCheck/1.0"}

def http_post(url, headers, body=None, timeout=30):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers={**UA, **headers}, method="POST" if body else "GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            try:
                return resp.status, json.loads(raw.decode())
            except Exception:
                return resp.status, {"error": "Invalid JSON"}
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read().decode())
        except:
            body = {}
        return e.code, body
    except Exception as e:
        return 0, {"error": str(e)}

def http_get(url, headers, timeout=15):
    req = urllib.request.Request(url, headers={**UA, **headers})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            if resp.headers.get("Content-Encoding") == "gzip":
                import gzip
                raw = gzip.decompress(raw)
            try:
                return resp.status, json.loads(raw.decode())
            except Exception:
                return resp.status, {"error": "Invalid JSON"}
    except urllib.error.HTTPError as e:
        try:
            raw = e.read()
            if e.headers.get("Content-Encoding") == "gzip":
                import gzip
                raw = gzip.decompress(raw)
            body = json.loads(raw.decode())
        except:
            body = {}
        return e.code, body
    except Exception as e:
        return 0, {"error": str(e)}

# ═══════════════════════════════════════════════
print("\n" + "="*60)
print("  🦞 OpenClaw Venture Studio — Health Check")
print("="*60)

# ── 1. CONFIG ──────────────────────────────────
print("\n── CONFIG ──")
config_path = os.path.expanduser("~/.openclaw/openclaw.json")
try:
    with open(config_path) as f:
        config = json.load(f)
    log(PASS, "CONFIG", "openclaw.json loaded")
except Exception as e:
    log(FAIL, "CONFIG", "openclaw.json", str(e))
    config = {}

agents = config.get("agents", {}).get("list", [])
agent_ids = [a["id"] for a in agents]
log(PASS if len(agents) >= 8 else WARN, "CONFIG", f"Agents: {len(agents)}", ", ".join(a.get('name','?') for a in agents))

bindings = config.get("bindings", [])
log(PASS if bindings else FAIL, "CONFIG", f"Bindings: {len(bindings)}")

# ── 2. NOTION ──────────────────────────────────
print("\n── NOTION ──")
notion_key = os.environ.get("NOTION_KEY") or os.environ.get("NOTION_API_KEY", "")
if not notion_key:
    sk = config.get("skills", {}).get("entries", {}).get("notion", {})
    notion_key = sk.get("apiKey", "")

if notion_key and not notion_key.startswith("${"):
    task_board_id = "08a013bae265417f806eec29e9bf8d11"
    headers = {
        "Authorization": f"Bearer {notion_key}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
    }
    for attempt in range(3):
        status, body = http_post(
            f"https://api.notion.com/v1/databases/{task_board_id}/query",
            headers, {"page_size": 1}
        )
        if status == 200:
            total = body.get("results", [])
            log(PASS, "NOTION", "Task Board query", f"HTTP {status}, {len(total)} result(s)" + (f" (attempt {attempt+1})" if attempt > 0 else ""))
            break
        elif attempt < 2:
            import time
            time.sleep(2)
        else:
            log(FAIL, "NOTION", "Task Board query", f"HTTP {status}: {body.get('message', body.get('error', '?'))} (after 3 attempts)")

    team_id = "d1b121b5e54c45ff8912ba3fd64d3402"
    status2, body2 = http_post(
        f"https://api.notion.com/v1/databases/{team_id}/query",
        headers, {"page_size": 1}
    )
    if status2 == 200:
        log(PASS, "NOTION", "Team DB query", f"HTTP {status2}")
    else:
        log(FAIL, "NOTION", "Team DB query", f"HTTP {status2}: {body2.get('message', '?')}")

    projects_id = "2f5b4d793a4b4caa81d0db4b84f52fea"
    status3, _ = http_post(
        f"https://api.notion.com/v1/databases/{projects_id}/query",
        headers, {"page_size": 1}
    )
    log(PASS if status3 == 200 else FAIL, "NOTION", "Projects DB query", f"HTTP {status3}")
else:
    log(FAIL, "NOTION", "API key", "Missing or unresolved")

# ── 3. GOOGLE DRIVE (gog) ─────────────────────
print("\n── GOOGLE DRIVE ──")
code, out, err = run("gog drive ls -a adam@larsson.work 2>&1 | head -3", timeout=15)
if code == 0 and out and "error" not in out.lower():
    log(PASS, "GOG", "Google Drive ls", out.split('\n')[0][:80])
else:
    combined = (out + " " + err).strip()
    if "gog" in combined.lower() and "not found" in combined.lower():
        code2, out2, _ = run("/home/node/.openclaw/gog drive ls -a adam@larsson.work 2>&1 | head -3", timeout=15)
        if code2 == 0 and out2 and "error" not in out2.lower():
            log(PASS, "GOG", "Google Drive ls (full path)", out2.split('\n')[0][:80])
        else:
            log(FAIL, "GOG", "Google Drive ls", combined[:120])
    else:
        log(FAIL, "GOG", "Google Drive ls", combined[:120])

# ── 4. BRAVE SEARCH ───────────────────────────
print("\n── BRAVE SEARCH ──")
brave_key = os.environ.get("BRAVE_API_KEY", "")
if not brave_key:
    sk = config.get("skills", {}).get("entries", {}).get("brave-search", {})
    brave_key = sk.get("apiKey", "")

if brave_key and not brave_key.startswith("${"):
    status, body = http_get(
        "https://api.search.brave.com/res/v1/web/search?q=test&count=1",
        {"Accept": "application/json", "Accept-Encoding": "gzip", "X-Subscription-Token": brave_key}
    )
    if status == 200:
        log(PASS, "BRAVE", "Web search", f"HTTP {status}")
    else:
        log(FAIL, "BRAVE", "Web search", f"HTTP {status}: {body.get('message', body.get('error', '?'))}")
else:
    log(FAIL, "BRAVE", "API key", "Missing or unresolved")

# ── 5. TELEGRAM ────────────────────────────────
print("\n── TELEGRAM ──")
tg_accounts = config.get("channels", {}).get("telegram", {}).get("accounts", {})
for name, acc in tg_accounts.items():
    token = acc.get("botToken", "")
    if token.startswith("${") or not token:
        log(WARN, "TELEGRAM", f"Bot '{name}'", "Token unresolved or missing")
        continue
    status, body = http_get(f"https://api.telegram.org/bot{token}/getMe", {})
    if status == 200 and body.get("ok"):
        bot_username = body.get("result", {}).get("username", "?")
        log(PASS, "TELEGRAM", f"Bot '{name}'", f"@{bot_username}")
    else:
        log(FAIL, "TELEGRAM", f"Bot '{name}'", f"HTTP {status}: {body}")

# ── 6. WHATSAPP ────────────────────────────────
print("\n── WHATSAPP ──")
wa_config = config.get("channels", {}).get("whatsapp", {})
if wa_config.get("accounts"):
    wa_allow = wa_config["accounts"].get("default", {}).get("allowFrom", [])
    log(PASS, "WHATSAPP", "Config present", f"{len(wa_allow)} numbers in allowlist")
    wa_binding = any(
        b.get("match", {}).get("channel") == "whatsapp" and b.get("agentId") == "main"
        for b in bindings
    )
    log(PASS if wa_binding else FAIL, "WHATSAPP", "Bull binding", "main -> whatsapp" if wa_binding else "MISSING")

    code, out, _ = run("grep -c 'Listening for personal WhatsApp' /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log 2>/dev/null || echo 0")
    count = out.strip() or "0"
    log(PASS if int(count) > 0 else WARN, "WHATSAPP", "Active listener", f"{count} connection(s) in today's log")
else:
    log(FAIL, "WHATSAPP", "Config", "No whatsapp accounts configured")

# ── 7. NANO BANANA PRO ────────────────────────
print("\n── NANO BANANA PRO ──")
code_uv, out_uv, _ = run("uv --version 2>&1")
if code_uv == 0 and "uv" in out_uv:
    log(PASS, "NANO-BANANA", "uv installed", out_uv)
else:
    log(FAIL, "NANO-BANANA", "uv missing", "Required for image generation")

gemini_key = os.environ.get("GEMINI_API_KEY", "")
if not gemini_key:
    sk = config.get("skills", {}).get("entries", {}).get("nano-banana-pro", {})
    gemini_key = sk.get("apiKey", "")
if gemini_key and not gemini_key.startswith("${"):
    log(PASS, "NANO-BANANA", "GEMINI_API_KEY", f"{gemini_key[:12]}...")
else:
    log(FAIL, "NANO-BANANA", "GEMINI_API_KEY", "Missing or unresolved")

script = "/app/skills/nano-banana-pro/scripts/generate_image.py"
if os.path.exists(script):
    log(PASS, "NANO-BANANA", "Script exists", script)
else:
    log(FAIL, "NANO-BANANA", "Script missing", script)

# ── 8. APOLLO ──────────────────────────────────
print("\n── APOLLO ──")
sk = config.get("skills", {}).get("entries", {}).get("apollo", {})
apollo_key = sk.get("apiKey", "")
if not apollo_key or apollo_key.startswith("${"):
    apollo_key = os.environ.get("APOLLO_API_KEY", "")

if apollo_key and not apollo_key.startswith("${"):
    status, body = http_get(
        "https://api.apollo.io/api/v1/auth/health",
        {"x-api-key": apollo_key}
    )
    if status == 200 and body.get("healthy"):
        log(PASS, "APOLLO", "Auth health", "healthy + logged_in")
    else:
        log(FAIL, "APOLLO", "Auth health", f"HTTP {status}: {body}")

    status2, body2 = http_post(
        "https://api.apollo.io/api/v1/organizations/search",
        {"Content-Type": "application/json", "x-api-key": apollo_key},
        {"page": 1, "per_page": 1}
    )
    if status2 == 200:
        total = body2.get("pagination", {}).get("total_entries", 0)
        log(PASS, "APOLLO", "Org search", f"{total:,} orgs available")
    else:
        log(FAIL, "APOLLO", "Org search", f"HTTP {status2}: {body2.get('error', '?')}")

    status3, body3 = http_post(
        "https://api.apollo.io/api/v1/people/match",
        {"Content-Type": "application/json", "x-api-key": apollo_key},
        {"email": "test@google.com"}
    )
    if status3 == 200:
        log(PASS, "APOLLO", "People match", "Enrichment works")
    elif "INACCESSIBLE" in str(body3):
        log(WARN, "APOLLO", "People match", "Requires higher plan")
    else:
        log(FAIL, "APOLLO", "People match", f"HTTP {status3}: {body3.get('error', '?')}")
else:
    log(FAIL, "APOLLO", "API key", "Missing or unresolved")

# ── 9. CRON JOBS ───────────────────────────────
print("\n── CRON JOBS ──")
jobs_path = os.path.expanduser("~/.openclaw/cron/jobs.json")
if not os.path.exists(jobs_path):
    jobs_path = os.path.expanduser("~/.openclaw/jobs.json")
try:
    with open(jobs_path) as f:
        raw = json.load(f)
    jobs = raw.get("jobs", raw) if isinstance(raw, dict) else raw
    active = [j for j in jobs if j.get("enabled", True)]
    log(PASS if active else WARN, "CRON", f"Jobs: {len(active)} active / {len(jobs)} total")
    for j in active[:10]:
        schedule = j.get("schedule", j.get("cron", "?"))
        agent = j.get("agentId", j.get("agent", "?"))
        label = j.get("label", j.get("name", j.get("id", "?")))
        log(PASS, "CRON", f"  {label}", f"agent={agent} schedule={schedule}")
except FileNotFoundError:
    log(WARN, "CRON", "jobs.json", "File not found — no cron jobs configured")
except Exception as e:
    log(FAIL, "CRON", "jobs.json", str(e))

# ── 10. AGENT BINDINGS ────────────────────────
print("\n── AGENT BINDINGS ──")
expected = {
    "main": ["telegram:byk", "whatsapp:default"],
    "strateg": ["telegram:eagle"],
    "bd": ["telegram:max"],
    "ziutek": ["telegram:ziutek"],
    "cmo": ["telegram:wito"],
    "hr": ["telegram:magic"],
    "cfo": ["telegram:lynx"],
    "cpo": ["telegram:beaver"],
}
for agent_id, expected_channels in expected.items():
    agent_bindings = [
        f"{b['match']['channel']}:{b['match']['accountId']}"
        for b in bindings if b.get("agentId") == agent_id
    ]
    for ec in expected_channels:
        if ec in agent_bindings:
            log(PASS, "BINDING", f"{agent_id} -> {ec}")
        else:
            log(FAIL, "BINDING", f"{agent_id} -> {ec}", "MISSING")

# ── SUMMARY ────────────────────────────────────
print("\n" + "="*60)
passes = sum(1 for r in results if r[0] == PASS)
fails = sum(1 for r in results if r[0] == FAIL)
warns = sum(1 for r in results if r[0] == WARN)
total = len(results)
print(f"  {PASS} {passes} passed  {FAIL} {fails} failed  {WARN} {warns} warnings  ({total} total)")
if fails == 0:
    print("  🎉 All critical checks passed!")
else:
    print(f"\n  ⚡ {fails} issue(s) need attention:")
    for r in results:
        if r[0] == FAIL:
            print(f"    {FAIL} [{r[1]}] {r[2]} — {r[3]}")
print("="*60 + "\n")

sys.exit(1 if fails > 0 else 0)
