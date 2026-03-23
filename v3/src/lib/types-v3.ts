export type SubStatus = 'waiting_client' | 'waiting_documents' | 'internal' | null;

export interface ClientMessage {
  id: string;
  task_id: string | null;
  channel: 'email' | 'telegram';
  direction: 'inbound' | 'outbound';
  sender: string;
  recipient?: string;
  subject?: string;
  body: string;
  message_id?: string;
  metadata?: string;
  created_at: string;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  source_type: 'file' | 'link' | 'document';
  source_url?: string;
  file_name?: string;
  file_size?: number;
  vector_store_file_id?: string;
  status: 'indexed' | 'pending' | 'failed' | 'deleting';
  tags?: string;
  description?: string;
  created_at: string;
}

export interface AgentLesson {
  id: string;
  agent_id: string;
  lesson: string;
  category: string;
  matter_id?: string;
  created_at: string;
}

export interface AgentFileInfo {
  name: string;
  path: string;
  content: string;
  size: number;
}

export interface ModelConfig {
  primary: string;
  fallbacks: string[];
}

export interface CostEntry {
  agent: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_estimate: number;
  date: string;
}
