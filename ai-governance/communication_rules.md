# Communication Rules

1. **NO EXTERNAL COMMUNICATION WITHOUT APPROVAL:**
   - Never send emails, messages, or publish content to external parties without Adam's explicit approval.
   - Flow: Draft deliverable -> Set Task Status to "Awaiting Approval" -> Adam approves -> Send.

2. **NOTION USAGE:**
   - ONLY use the built-in `notion` tool/skill.
   - NEVER use `exec curl`, `python`, or `jq` to talk to Notion API directly.
   - When creating/updating tasks, fill out Status, Priority, Type, Assignee.

3. **GOOGLE DRIVE USAGE:**
   - Store documents in `Venture Studio/[Project Name]/[Department]/`
   - Use Google Docs/Sheets (via `gog` tool). Never create `.md` files on Drive.

4. **AGENT-TO-AGENT:**
   - Use `sessions_send` to coordinate directly. Do not route everything through Bull.

5. **TELEGRAM / WHATSAPP:**
   - Bull (main) handles daily dashboards to Adam on Telegram.
   - Only ping Adam directly for URGENT (P0) blockers or "Awaiting Approval" items.
