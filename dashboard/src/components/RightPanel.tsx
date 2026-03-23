'use client';

import { useState } from 'react';
import { LiveFeed } from './LiveFeed';
import { AgentChatPanel } from './AgentChatPanel';
import { Rss, MessageSquare } from 'lucide-react';

type Tab = 'feed' | 'chat';

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('chat');

  return (
    <div className="w-80 bg-mc-bg-secondary border-l border-mc-border flex flex-col">
      <div className="flex border-b border-mc-border">
        <button
          onClick={() => setTab('feed')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm ${
            tab === 'feed' ? 'bg-mc-accent/20 text-mc-accent border-b-2 border-mc-accent' : 'text-mc-text-secondary hover:bg-mc-bg-tertiary'
          }`}
        >
          <Rss className="w-4 h-4" />
          Feed
        </button>
        <button
          onClick={() => setTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm ${
            tab === 'chat' ? 'bg-mc-accent/20 text-mc-accent border-b-2 border-mc-accent' : 'text-mc-text-secondary hover:bg-mc-bg-tertiary'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Agent Chat
        </button>
      </div>
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {tab === 'feed' && <div className="flex-1 min-h-0 overflow-hidden"><LiveFeed /></div>}
        {tab === 'chat' && <div className="flex-1 min-h-0 overflow-hidden"><AgentChatPanel /></div>}
      </div>
    </div>
  );
}
