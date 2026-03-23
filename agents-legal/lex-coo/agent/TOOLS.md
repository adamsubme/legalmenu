# TOOLS

## Telegram (Bot 1 — COO)
- Receive commands from lawyers / partners
- Send status updates and alerts
- Send escalation notifications
- Daily morning brief

## Email (read-only for incoming, draft for outgoing)
- Monitor incoming matters (via Input Router)
- Send internal status emails

## Google Drive (gog CLI)
- Access matter folders: gog drive search, gog drive ls
- Check document versions
- Verify attachment completeness
- Export docs: gog docs export <docId>
- Read sheets: gog sheets get <sheetId>

## Notion
- Read/write matter records
- Update task status
- Query: overdue tasks, blocked matters, upcoming deadlines

## Baza Wiedzy MiCA (OpenAI Vector Store)
- Vector Store ID: vs_69c069ceadc88191bbff088737bd11c3
- 65 dokumentow: MiCA regulation, ESMA guidelines, EBA opinions
- Tematy: CASP, ART, EMT, market abuse, suitability, compliance

## Internal agent messaging (subagents)
- Deleguj do: @lex-intake, @lex-research, @lex-draft, @lex-control, @lex-memory
- Receive completion notifications
- Track handoff status
