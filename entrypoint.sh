#!/bin/sh
mkdir -p /home/node/.config
ln -sf /home/node/.openclaw/gogcli-config /home/node/.config/gogcli
export PATH="/home/node/.openclaw:/home/node/.local/bin:$PATH"

if ! command -v uv > /dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh > /dev/null 2>&1
fi
cp /home/node/.local/bin/uv /usr/local/bin/uv 2>/dev/null || true

python3 -c "import requests" 2>/dev/null || uv pip install --system --break-system-packages requests > /dev/null 2>&1
command -v jq > /dev/null 2>&1 || { apt-get update -qq > /dev/null 2>&1 && apt-get install -y -qq jq > /dev/null 2>&1; }

if ! command -v chromium > /dev/null 2>&1 && ! command -v chromium-browser > /dev/null 2>&1; then
  apt-get update -qq > /dev/null 2>&1 && apt-get install -y -qq chromium > /dev/null 2>&1 || true
fi

mkdir -p /home/node/.config/notion
echo -n "$NOTION_API_KEY" > /home/node/.config/notion/api_key
echo -n "$NOTION_API_KEY" > /home/node/.notion_token
echo -n "$NOTION_API_KEY" > /home/node/.openclaw/.notion_token

if [ -f /home/node/.openclaw/skills/notion/SKILL.md ]; then
  mkdir -p /app/skills/notion
  chmod 777 /app/skills/notion 2>/dev/null || true
  cp -f /home/node/.openclaw/skills/notion/SKILL.md /app/skills/notion/SKILL.md 2>/dev/null || true
fi

exec "$@"
