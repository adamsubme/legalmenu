#!/bin/bash
set -e
cd /root/mission-control

echo "[1/4] Creating directories..."
mkdir -p src/app/login
mkdir -p src/app/api/auth/login
mkdir -p src/app/api/auth/logout

echo "[2/4] Auth files already copied by SCP..."

echo "[3/4] Building..."
npx next build 2>&1 | tail -20

echo "[4/4] Rebuilding Docker..."
docker build -t mission-control:v3-auth . 2>&1 | tail -10

docker stop mission-control 2>/dev/null || true
docker rm mission-control 2>/dev/null || true

docker run -d \
  --name mission-control \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /root/mission-control-data/mission-control.db:/app/mission-control.db \
  -v /root/case-attachments:/app/attachments \
  -v /root/.openclaw:/root/.openclaw:rw \
  --add-host=host.docker.internal:host-gateway \
  -e OPENCLAW_GATEWAY_URL=ws://host.docker.internal:18789 \
  -e OPENCLAW_GATEWAY_TOKEN=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678 \
  -e OPENAI_API_KEY=$(grep OPENAI_API_KEY /root/.openclaw/.env | cut -d= -f2) \
  -e AUTH_USERNAME=Admin \
  -e AUTH_PASSWORD='Mica#3000' \
  -e SESSION_SECRET='lex-legal-session-$(openssl rand -hex 16)' \
  mission-control:v3-auth

sleep 3
echo "=== Container logs ==="
docker logs mission-control --tail 10

echo ""
echo "=== Testing pages ==="
for page in login "" cases agents; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/$page)
  echo "/$page -> $code"
done

echo ""
echo "=== Auth test ==="
curl -s http://localhost:3000/api/tasks 2>/dev/null | head -c 100
echo ""
echo "=== DONE ==="
