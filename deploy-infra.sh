#!/bin/bash
set -e

# ============================================================
# 1. BACKUP SCRIPT
# ============================================================
mkdir -p /scripts /backups

cat > /scripts/backup-openclaw.sh << 'ENDSCRIPT'
#!/bin/bash
set -e

BACKUP_DIR="/backups/openclaw/$(date +%Y-%m-%d)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting OpenClaw backup..."

tar czf "$BACKUP_DIR/openclaw-data-${TIMESTAMP}.tar.gz" \
  -C /root/.openclaw \
  agents \
  openclaw.json \
  .env \
  2>/dev/null || true

tar czf "$BACKUP_DIR/mission-control-${TIMESTAMP}.tar.gz" \
  -C /root \
  mission-control/mission-control.db \
  case-attachments \
  2>/dev/null || true

TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
FILE_COUNT=$(ls -1 "$BACKUP_DIR" | wc -l)

echo "[$(date)] Backup completed: $BACKUP_DIR ($FILE_COUNT files, $TOTAL_SIZE)"

# Retention: delete backups older than 90 days
find /backups/openclaw -maxdepth 1 -type d -mtime +90 -exec rm -rf {} \; 2>/dev/null || true

RETAINED=$(ls -1d /backups/openclaw/*/ 2>/dev/null | wc -l)
echo "[$(date)] Retained $RETAINED backup sets (90-day retention)"
ENDSCRIPT

chmod +x /scripts/backup-openclaw.sh
echo "[OK] Backup script created: /scripts/backup-openclaw.sh"

# ============================================================
# 2. CRON JOB (daily at 3:00 AM Warsaw time)
# ============================================================
(crontab -l 2>/dev/null | grep -v backup-openclaw; echo "0 3 * * * /scripts/backup-openclaw.sh >> /var/log/openclaw-backup.log 2>&1") | crontab -
echo "[OK] Cron job set: daily at 3:00 AM"

# ============================================================
# 3. RUN FIRST BACKUP NOW
# ============================================================
/scripts/backup-openclaw.sh

# ============================================================
# 4. UPDATE SYSTEMD SERVICE with env vars
# ============================================================
cat > /etc/systemd/system/openclaw-legal.service << 'ENDSERVICE'
[Unit]
Description=OpenClaw Legal Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/.openclaw
EnvironmentFile=/root/.openclaw/.env
ExecStart=/root/.openclaw/bin/openclaw gateway --bind lan
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openclaw-legal

# Resource limits
LimitNOFILE=65536
MemoryMax=4G

[Install]
WantedBy=multi-user.target
ENDSERVICE

systemctl daemon-reload
echo "[OK] Systemd service updated with EnvironmentFile"

# ============================================================
# 5. VERIFY .env has all required vars
# ============================================================
echo ""
echo "=== Checking .env ==="
for VAR in OPENCLAW_GATEWAY_TOKEN MINIMAX_API_KEY ZAI_API_KEY GEMINI_API_KEY OPENAI_API_KEY TG_BOT_LEX_TOKEN GOG_KEYRING_PASSWORD GOG_ACCOUNT; do
  if grep -q "^${VAR}=" /root/.openclaw/.env 2>/dev/null; then
    echo "  [OK] $VAR"
  else
    echo "  [MISSING] $VAR"
  fi
done

echo ""
echo "=== INFRASTRUCTURE DEPLOYED ==="
