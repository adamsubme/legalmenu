'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Search, Plus, Phone, Mail, MessageCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { Client, ClientWithStats } from '@/lib/types';
import { api } from '@/lib/api-client';

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '', telegram_username: '' });

  useEffect(() => {
    loadClients();
  }, [search]);

  async function loadClients() {
    try {
      const url = search ? `/clients?search=${encodeURIComponent(search)}` : '/clients';
      const data = await api.get<ClientWithStats[]>(url);
      setClients(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/clients', newClient);
      setShowCreate(false);
      setNewClient({ name: '', email: '', phone: '', telegram_username: '' });
      loadClients();
    } catch (e) { console.error(e); }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-zinc-400 mt-1">{clients.length} clients total</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
          <Plus className="h-4 w-4" /> New Client
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-4 gap-4">
              <Input
                placeholder="Client name *"
                value={newClient.name}
                onChange={e => setNewClient({ ...newClient, name: e.target.value })}
                required
              />
              <Input
                placeholder="Email"
                type="email"
                value={newClient.email}
                onChange={e => setNewClient({ ...newClient, email: e.target.value })}
              />
              <Input
                placeholder="Phone"
                value={newClient.phone}
                onChange={e => setNewClient({ ...newClient, phone: e.target.value })}
              />
              <Input
                placeholder="Telegram username"
                value={newClient.telegram_username}
                onChange={e => setNewClient({ ...newClient, telegram_username: e.target.value })}
              />
              <div className="col-span-4 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit">Create Client</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search clients..."
          className="pl-10"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-zinc-500">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No clients found</p>
              <Button variant="ghost" onClick={() => setShowCreate(true)} className="mt-2">
              Create your first client
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {clients.map(client => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="hover:border-zinc-600 transition-all hover:shadow-lg hover:shadow-black/20 cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-2xl">
                      <Users className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-zinc-100 hover:text-blue-400 transition-colors">{client.name}</h3>
                      
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-zinc-500">
                        {client.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {client.email}
                          </span>
                        )}
                        {client.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {client.phone}
                          </span>
                        )}
                        {client.telegram_username && (
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" /> @{client.telegram_username}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-3">
                        <Badge variant="outline" className="text-[10px]">
                          {client.project_count || 0} projects
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {client.active_task_count || 0} active tasks
                        </Badge>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-zinc-600" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
