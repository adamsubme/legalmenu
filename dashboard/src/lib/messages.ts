/**
 * Centralised user-facing strings for Mission Control.
 *
 * All human-readable text that a user can see — API error responses,
 * UI labels, workflow status names, validation messages — lives here.
 *
 * How to use:
 *
 *   import { api, ui, workflow } from '@/lib/messages';
 *
 *   // API route
 *   return NextResponse.json({ error: api.tasks.notFound }, { status: 404 });
 *
 *   // Zod schema
 *   export const createTaskSchema = z.object({
 *     title: nonEmptyString(1, 500, 'Title is required'),
 *   });
 *
 *   // JSX
 *   <Button>{ui.buttons.save}</Button>
 *
 * Design principles:
 *  - Keys are English camelCase slugs — self-documenting, no translation leakage
 *  - Values are the default language (English, with Polish preserved where it exists)
 *  - When adding a string, also add it here — no hardcoded strings in routes/components
 *  - When changing a string, change it here — routes/components inherit automatically
 */

// ── API error strings ───────────────────────────────────────────────────────────

export const api = {
  // Generic
  unauthorized:      'Unauthorized',
  forbidden:         'Forbidden',
  notFound:          (resource: string) => `${resource} not found`,
  internalError:     (what: string)    => `Failed to ${what}`,
  invalidPayload:     (hint: string)    => `Invalid payload. ${hint}`,
  connectionFailed:  (service: string) => `Failed to connect to ${service}`,

  // Tasks
  tasks: {
    notFound:      'Task not found',
    invalidParams: 'Invalid route parameters',
    noUpdates:     'No updates provided',
    notFoundDetailed: 'Task not found or you do not have access',
  },

  // Agents
  agents: {
    notFound:     'Agent not found',
    alreadyLinked: 'Agent is already linked to an OpenClaw session',
    notLinked:     'Agent is not linked to an OpenClaw session',
    notMapped:     (name: string) =>
      `Agent "${name}" is not mapped to an OpenClaw agent.`,
  },

  // Clients
  clients: {
    notFound: 'Client not found',
  },

  // Knowledge
  knowledge: {
    notFound:        'Knowledge entry not found',
    searchUnavailable: 'Search unavailable (no API key and DB search failed)',
  },

  // OpenClaw / sessions
  openclaw: {
    sessionNotFound:     'Session not found',
    sessionNotFoundDb:   'Session not found in database',
    noUpdates:           'No updates provided',
    agentNotFound:        'Agent not found in gateway config',
    invalidGatewayConfig: 'Invalid gateway config structure',
    invalidJsonBody:      'Invalid JSON body',
    modelRequired:        '"model" must be a non-empty string',
    heartbeatRequired:    '"heartbeat" must be an object',
    sessionKeyRequired:   'sessionKey is required',
    modelNotAllowed:      (model: string) => `"${model}" is not an allowed model`,
  },

  // Communications
  communications: {
    channelRequired: 'channel, direction, body required',
  },

  // Planning
  planning: {
    notFound:           'Task not found',
    alreadyStarted:      'Planning already started',
    questionsUnanswered: 'All questions must be answered before locking',
    specLocked:          'Spec already locked',
  },

  // Activities
  activities: {
    required: 'activity_type and message are required',
  },

  // Deliverables
  deliverables: {
    noTestable:    'No testable deliverables found (file or url types)',
    testExecution: 'Test execution failed',
    fileNotFound:  'File not found',
    skipped:        'Skipped - not an HTML file',
    pathNotFound:   'Path not found',
  },

  // Attachments
  attachments: {
    fileRequired:   'file and taskId (or task_id) are required',
    pathRequired:   'path is required',
    invalidPath:    'Invalid path',
    notFound:       'Not found',
    notAFile:       'Not a file',
    invalidType:    'Invalid attachment_type',
    filePathRequired:  'file_path required for file type',
    urlRequired:       'url required for link type',
    typeRequiredForNote: 'content is required for note',
  },

  // Messages
  messages: {
    contentRequired: 'Content is required',
  },

  // Deploy
  deploy: {
    notFound: 'deploy.sh not found',
  },

  // Workspaces
  workspaces: {
    nameRequired:     'Name is required',
    alreadyExists:     'A workspace with this name already exists',
  },

  // Users
  users: {
    notFound:         'User not found',
    allFieldsRequired: 'All fields are required',
    alreadyExists:     'User already exists',
    cannotDeleteAdmin: 'Cannot delete admin user',
    adminOnly:         'Forbidden — Admin only',
  },

  // Events
  events: {
    contentRequired: 'event_type and description are required',
  },

  // Subagent
  subagent: {
    sessionRequired: 'openclaw_session_id is required',
  },

  // Models
  models: {
    readFailed: 'Failed to read models config',
  },

  // Agent completion webhook
  agentCompletion: {
    invalidFormat:  'Invalid completion message format. Expected: TASK_COMPLETE: [summary]',
    sessionNotFound: 'Session not found or inactive',
    noActiveTask:   'No active task found for this agent',
    invalidPayload:  'Invalid payload. Provide either task_id or session_id + message',
  },

  // SSE stream
  stream: {
    rateLimited: 'Too many SSE connections from this IP',
  },

  // Middleware
  middleware: {
    unauthorized: 'Unauthorized',
  },
} as const;

// ── UI strings ────────────────────────────────────────────────────────────────

export const ui = {
  // Navigation / page headers
  nav: {
    missionControl:  'Mission Control',
    dashboard:       'Dashboard',
    cases:           'Cases',
    agents:          'Agents',
    knowledge:       'Knowledge Base',
    clients:         'Clients',
    communications:  'Communications',
    escalations:     'Escalations',
    costs:           'Costs',
    documents:       'Documents',
    settings:        'Settings',
    login:           'Sign In',
    register:        'Create Account',
  },

  // Buttons
  buttons: {
    save:       'Save',
    cancel:     'Cancel',
    delete:     'Delete',
    edit:       'Edit',
    refresh:    'Refresh',
    send:       'Send',
    search:     'Search',
    close:      'Close',
    back:       'Back',
    reset:      'Reset',
    newClient:  'New Client',
    newProject: 'New Project',
    newCase:    'New Case',
    newTask:    'New Task',
    saveLink:   'Save Link',
    chooseFile: 'Choose File',
    uploadFile: 'Upload File',
    addLink:    'Add Link',
    addNote:    'Note',
    addEntry:   'Add Entry',
    startPlanning:  'Start Planning',
    continuePlanning: 'Continue planning',
    sendToAgent: 'Wyślij do agenta',
    sendToAgentPlaceholder: (name: string) => `Wyślij do ${name}...`,
  },

  // Status pills / labels
  status: {
    notStarted:      'NOT STARTED',
    inProgress:       'IN PROGRESS',
    blocked:          'BLOCKED',
    awaitingApproval:  'AWAITING APPROVAL',
    done:              'DONE',
    active:            'Active',
    inactive:          'Inactive',
    online:            'ONLINE',
    offline:           'OFFLINE',
  },

  // Form labels
  labels: {
    title:       'Title',
    description: 'Description',
    status:      'Status',
    priority:    'Priority',
    assignTo:    'Assign to',
    dueDate:     'Due Date',
    client:      'Client',
    project:     'Project',
    agent:       'Agent',
    name:        'Name',
    email:       'Email',
    role:        'Role',
    phone:       'Phone',
    telegram:     'Telegram username',
    recipient:   'Recipient',
    subject:      'Subject',
    message:     'Message',
    body:        'Body',
    searchPlaceholder: 'Search...',
    workspacePaths: 'Workspace Paths',
    apiConfiguration: 'API Configuration',
    missionControlUrl: 'Mission Control URL',
    userManagement: 'User Management',
    environmentVariables: 'Environment Variables',
  },

  // Placeholders
  placeholders: {
    searchClients:       'Search clients...',
    searchCases:         'Search cases...',
    searchKnowledge:     "Search the knowledge base... e.g. 'MiCA requirements for stablecoin issuers'",
    searchDocuments:      'Search documents...',
    searchMessages:      'Search messages...',
    whatNeedsToBeDone:   'What needs to be done?',
    addDetails:          'Add details...',
    descriptionOptional: 'Description (opcjonalnie)',
    titleRequired:       'Tytuł *',
    urlRequired:          'URL *  (https://...)',
    noteTitleRequired:    'Tytuł notatki *',
    noteContentRequired:  'Treść notatki *',
    pleaseSpecify:        'Please specify...',
    composeMessage:       'Message...',
    message:              'Wiadomość...',
    sendToAgent:          'Wyślij zadanie do agenta lub poczekaj na delegację z COO',
    selectAgentConversation: 'Wybierz agenta, aby zobaczyć konwersację',
    fileOrClickToSelect:  'Przeciągnij pliki lub kliknij, aby wybrać (PDF, DOCX, JPG, ...)',
    addDetailsOptional:   'Opis (opcjonalnie)',
    addAgent:             'Add new agent...',
    whatDoesAgentDo:      'What does this agent do?',
    agentNameExample:     'e.g., Code & Automation',
    lastNameFirst:        'Nazwisko Imię',
  },

  // Empty states
  empty: {
    noUrgentCases:    'No urgent cases',
    noClients:         'No clients found',
    noMessages:        'No messages',
    noDocuments:       'No Documents',
    noCaseDocuments:   'Brak dokumentów. Dodaj pliki, linki lub notatki do sprawy.', // Polish
    noActivity:       'No activity recorded yet',
    noCaseKnowledge:   'No case knowledge entries yet.',
    noProjectKnowledge: 'No project-specific knowledge entries.',
    noClientKnowledge:  'No client-specific knowledge entries.',
    noGlobalKnowledge:  'No global legal knowledge configured.',
    noAttachments:      'No files or links attached yet.',
    noConversations:   'No conversations',
    noTasks:           'No tasks',
    noUsers:           'No users found.',
    noAgentUsageData:  'No agent usage data yet',
    noModelUsageData:  'No model usage data yet',
    noEscalations:     'All processes are running smoothly',
    noCommunications:   'No Communications',
    noSearchResults:   'No results found',
  },

  // Tabs
  tabs: {
    overview:     'Overview',
    planning:     'Planning',
    activity:     'Activity',
    deliverables: 'Deliverables',
    sessions:     'Sessions',
    komunikacja:  'Komunikacja',   // Polish
    dokumenty:    'Dokumenty',     // Polish
  },

  // Agent tab sections (case detail)
  agentSections: {
    relevantLegalKnowledge: 'Relevant Legal Knowledge',
    caseKnowledge:           'Case Knowledge Base',
    projectKnowledge:         'Project Knowledge',
    clientKnowledge:          'Client Knowledge',
    globalLegalKnowledge:    'Global legal framework, regulations, and precedents applicable to this case.',
    caseKnowledgeDescription: 'Knowledge will be generated as agents analyze the case.',
  },

  // Loading / processing
  processing: {
    loading:            'Loading...',
    loadingAgents:     'Ładowanie komunikacji agentów...', // Polish
    loadingMessages:    'Ładowanie...', // Polish
    sending:            'Sending...',
    uploading:          'Przesyłanie...', // Polish
    processing:         'Processing...',
    creating:           'Creating...',
    saving:             'Saving...',
    startingPlanning:   'Starting...',
    planningInProgress: 'Planning in progress...',
    waitingNextQuestion: 'Waiting for next question...',
  },

  // Agent / session status
  agents: {
    agentsActive:    'Agents Active',
    tasksInQueue:    'Tasks in Queue',
    selectConversation: 'Choose a Telegram chat from the inbox to continue',
    noSessions:      'Brak sesji',  // Polish
    noMessagesFor:   (agent: string) => `Brak wiadomości od ${agent}`, // Polish
    sentTo:          (name: string) => `Wysłano do ${name}`, // Polish
    sentToAgent:     'Wyślij zadanie do agenta lub poczekaj na delegację z COO', // Polish
  },

  // Communications
  comms: {
    compose:    'Compose',
    inbox:      'Inbox',
    liveChat:   'Live Chat',
    all:        'All',
    email:      'Email',
    telegram:   'Telegram',
    liveTelegramChats: 'Live Telegram Chats',
    messageHistory:    'Message History',
    selectConversation:  'Select a conversation',
    noMessagesYetChat: 'No messages yet in this chat',
    messagesAppearHere: 'Messages will appear here when received',
    conversationTitle:  'Agent Workflow',
    casesCount:        (total: number, blocked: number) =>
      `${total} cases • ${blocked} blocked`,
  },

  // Costs
  costs: {
    totalCost:    'Total Cost',
    totalTokens:  'Total Tokens',
    requests:     'Requests',
    byAgent:      'By Agent',
    byModel:      'By Model',
    periodLabel:  (period: string) => `Usage data from gateway logs (${period})`,
  },

  // Settings
  settings: {
    savedSuccess:      'Settings saved successfully',
    workspacePathsDesc: 'Configure where Mission Control stores projects and deliverables.',
    apiConfigDesc:     'Mission Control API URL for agent orchestration.',
    userManagementDesc: (role: string) =>
      `Only administrators can manage users. Your current role: ${role}`,
    newUser:           'New User',
    editUser:          (email: string) => `Edit User: ${email}`,
    createNewUser:     'Create New User',
    lastLogin:         'Last Login',
    actions:           'Actions',
    deactivate:        'Deactivate',
    accountCreated:    'Account Created!',
    redirecting:       'Redirecting to dashboard...',
    alreadyHaveAccount: 'Already have an account?',
    signIn:            'Sign in',
  },

  // Planning
  planningTab: {
    deliverables:   'Deliverables:',
    successCriteria:'Success Criteria:',
    agentsCreated:  'Agents Created:',
    planningComplete:'Planning Complete',
    askQuestions:    "I'll ask you a few questions to understand exactly what you need.",
    multipleChoice:  'All questions are multiple choice — just click to answer.',
    viewConversation:(count: number) => `View conversation (${count} messages)`,
    continueTo:      'Continue →',
    questionsToClient: 'Questions to Client',
    waitingForDocuments: 'Waiting for Documents',
    internalBlocks:    'Internal Blocks',
  },

  // Case detail
  caseDetail: {
    caseNotFound:   'Case not found',
    noMessagesYet:  'No messages yet. Agents will discuss this case here.',
    sendMessageTo:  (name: string) => `Wyślij do ${name}...`,
    viewCase:       'View case',
    documentsAttached: (count: number) => `${count} attachments across all cases`,
  },

  // Task status labels
  task: {
    new:           'New',
    inProgress:    'In Progress',
    blocked:       'Blocked',
    awaitingReview:'Awaiting Review',
    done:          'Done',
  },

  // Misc UI
  misc: {
    lexLegalTitle:  'Lex Legal AI · Mission Control v3',
    lexLegal:       'Lex Legal',
    signInToMC:     'Sign in to Mission Control',
    joinLex:        'Join Lex Legal',
    fullName:       'Full Name',
    password:       'Password',
    confirmPassword:'Confirm Password',
    creatingAccount:'Creating account...',
    passwordsDontMatch: 'Passwords do not match',
    connectionError:    'Connection error',
    invalidCredentials:  'Invalid credentials',
    file:           'plik',   // Polish — file type label
    link:           'link',   // Polish — link type label
    note:           'notatka', // Polish — note type label
    confirmDelete:   (title: string) => `Usuń "${title}"?`,
  },

  // Documents
  documents: {
    title:        'Documents',
    files:        'Files',
    links:        'Links',
    notes:        'Notes',
    all:          'All',
    documentsAppear: 'Documents added to cases will appear here',
  },

  // Escalations
  escalations: {
    title:      'Escalations',
    blocked:    'Blocked',
    waitingClient: 'Waiting Client',
    waitingDocs:  'Waiting Docs',
    internal:   'Internal',
    unblock:    'Unblock',
  },

  // Error boundary
  error: {
    somethingWentWrong: 'Something went wrong',
  },

  // Knowledge
  knowledge: {
    searchResults:   'Search Results',
    indexedEntries:   'Indexed Entries',
    score:            'Score:',
    tags:             'Tags (comma-separated)',
    descriptionPlaceholder: 'Description...',
  },

  // Refresh / expand tooltips
  tooltips: {
    refresh:   'Odśwież',   // Polish
    minimize:  'Minimalizuj', // Polish
    fullScreen:'Pełny ekran',  // Polish
    showContent: 'Pokaż treść',  // Polish
    download:  'Pobierz',   // Polish
    delete:    'Usuń',      // Polish
  },
} as const;

// ── Workflow / pipeline labels ────────────────────────────────────────────────

export const workflow = {
  // Pipeline stages
  stages: {
    intake:      'Intake',
    research:   'Research',
    drafting:   'Drafting',
    review:     'Review',
    clientInput:'Client Input',
    done:       'Done',
  },

  // Stage progress labels
  stageProgress: {
    researchInProgress: 'Research in Progress',
    draftingInProgress:  'Drafting in Progress',
    reviewInProgress:    'Review in Progress',
    approved:           'Approved',
    delivered:          'Delivered',
  },

  // Sub-status labels
  subStatus: {
    waitingClient:     'Waiting for client',
    waitingDocuments:  'Waiting for documents',
    internal:          'Internal block',
  },

  // Task dispatch messages (Polish — as stored in DB)
  dispatchMessages: {
    taskSent:    (taskTitle: string, agentName: string) =>
      `Zadanie "${taskTitle}" wysłane do ${agentName}`,
    taskPassed:  (agentName: string) =>
      `Zadanie przekazane do ${agentName} via OpenClaw`,
    verifyDocs:  'Zweryfikuj formalną poprawność dokumentu, sprawdź zgodność z przepisami.',
    askClient:   'Przygotuj pytania do klienta, wyjaśnij opcje, poczekaj na decyzję.',
    saveToKb:    'Zapisz dokumenty i wnioski do bazy wiedzy, zarchiwizuj sprawę.',
    noContext:   '(Brak kontekstu w bazie wiedzy)',
    responseFormat: '**Format odpowiedzi:**',
    whatWasDone:    'Co wykonano na tym etapie',
    whatDocs:        'Jakie dokumenty wygenerowano / zaktualizowano',
    whatNext:        'Co dalej — następny krok lub potrzebna decyzja',
  },

  // Seed event messages (Polish)
  seedEvents: {
    teamInitialized: 'Legal AI Team zainicjowany',
    cooJoined:       'Lex COO dolaczyl jako orchestrator',
    intakeJoined:    'Lex Intake dolaczyl — intake spraw',
    researchJoined:  'Lex Research dolaczyl — analiza prawna',
    draftJoined:     'Lex Draft dolaczyl — tworzenie dokumentow',
    controlJoined:   'Lex Control dolaczyl — kontrola jakosci',
    memoryJoined:    'Lex Memory dolaczyl — baza wiedzy',
    teamReady:        'Zespol prawny gotowy. Workflow: Intake → Research → Draft → Control → Memory.',
  },
} as const;

// ── Validation error strings ─────────────────────────────────────────────────

export const validation = {
  invalidUuid:      'Invalid UUID format',
  invalidEmail:     'Invalid email address',
  passwordMinLength:'Password must be at least 8 characters',
  invalidUrl:       'Invalid URL format',
  invalidJson:      'Request body must be valid JSON',
  titleRequired:    'title is required',
  contentRequired:  'content is required',
  taskIdRequired:   'taskId is required',
} as const;

// ── Convenience re-exports for common patterns ─────────────────────────────────

/**
 * Shortcut for the most common API errors.
 * Usage: return NextResponse.json({ error: api.notFound('Task') }, { status: 404 })
 */
export const notFound    = (r: string) => api.notFound(r);
export const internalErr = (w: string) => api.internalError(w);
