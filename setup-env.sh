#!/bin/bash
# Setup environment variables for Mission Control
# Run as: sudo ./setup-env.sh
#
# This script creates /etc/environment.d/mission-control.conf
# with required secrets (loaded by systemd PM2 service)

set -e

SECRETS_FILE="/etc/environment.d/mission-control.conf"

echo "=== Mission Control Environment Setup ==="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "⚠️  Please run as root: sudo $0"
  exit 1
fi

# Required variables
REQUIRED_VARS=(
  "AGENT_API_KEY"
  "MC_LOGIN_PASSWORD"
  "AUTH_PASSWORD"
  "OPENCLAW_GATEWAY_TOKEN"
  "OPENAI_API_KEY"
)

echo "Checking required environment variables..."
MISSING=0
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "  ❌ $var is not set"
    MISSING=1
  else
    echo "  ✅ $var is set"
  fi
done

if [ $MISSING -eq 1 ]; then
  echo ""
  echo "Please set the missing variables before running this script."
  echo "Example:"
  echo "  export AGENT_API_KEY='your-agent-api-key'"
  echo "  export MC_LOGIN_PASSWORD='your-secure-password'"
  echo "  export AUTH_PASSWORD='your-secure-password'"
  echo "  export OPENCLAW_GATEWAY_TOKEN='your-gateway-token'"
  echo "  export OPENAI_API_KEY='sk-proj-your-key'"
  echo ""
  echo "Then run: sudo -E $0"
  exit 1
fi

# Write to /etc/environment.d/
echo ""
echo "Writing secrets to $SECRETS_FILE..."
{
  echo "# Mission Control - Environment Variables"
  echo "# Auto-generated on $(date)"
  echo ""
  echo "AGENT_API_KEY=${AGENT_API_KEY}"
  echo "MC_LOGIN_USER=${MC_LOGIN_USER:-admin@lex.com}"
  echo "MC_LOGIN_PASSWORD=${MC_LOGIN_PASSWORD}"
  echo "AUTH_USERNAME=${AUTH_USERNAME:-Admin}"
  echo "AUTH_PASSWORD=${AUTH_PASSWORD}"
  echo "OPENCLAW_GATEWAY_URL=${OPENCLAW_GATEWAY_URL:-ws://127.0.0.1:18789}"
  echo "OPENCLAW_GATEWAY_TOKEN=${OPENCLAW_GATEWAY_TOKEN}"
  echo "OPENAI_API_KEY=${OPENAI_API_KEY}"
  echo "DATABASE_PATH=${DATABASE_PATH:-/root/mission-control/dashboard/mission-control.db}"
  echo "SESSION_SECRET=${SESSION_SECRET:-$(openssl rand -base64 32)}"
  echo "MISSION_CONTROL_ORIGIN=${MISSION_CONTROL_ORIGIN:-http://127.0.0.1:3000}"
  # Optional Telegram tokens (for OpenClaw channels)
  echo "TG_BOT_LEX_TOKEN=${TG_BOT_LEX_TOKEN:-}"
  echo "TG_BOT_INTAKE_TOKEN=${TG_BOT_INTAKE_TOKEN:-}"
} > "$SECRETS_FILE"

chmod 600 "$SECRETS_FILE"
echo "✅ Secrets written to $SECRETS_FILE"
echo ""
echo "⚠️  Remember to:"
echo "   1. Restart PM2: pm2 restart mission-control"
echo "   2. Restart OpenClaw if Telegram tokens were added"
echo ""
echo "Done!"
