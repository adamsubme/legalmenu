'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Mail, Phone, MessageCircle, ArrowLeft, ExternalLink, Calendar, Folder } from 'lucide-react';
import Link from 'next/link';
import type { ClientWithStats, Project } from '@/lib/types';

export default function ClientDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [client, setClient] = useState<ClientWithStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', telegram_username: '' });

  useEffect(() => {
    loadClient();
  }, [id]);

  async function loadClient() {
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data);
        setFormData({
          name: data.name,
          email: data.email || '',
          phone: data.phone || '',
          telegram_username: data.telegram_username || '',
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setEditing(false);
        loadClient();
      }
    } catch (e) { console.error(e); }
  }

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;
  }

  if (!client) {
    return <div className="p-6 text-zinc-500">Client not found</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
          <p className="text-sm text-zinc-400">Client details</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Contact Information</span>
              <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>
                {editing ? 'Cancel' : 'Edit'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-zinc-400">Name</label>
                    <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Email</label>
                    <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Phone</label>
                    <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400">Telegram</label>
                    <Input value={formData.telegram_username} onChange={e => setFormData({ ...formData, telegram_username: e.target.value })} />
                  </div>
                </div>
                <Button type="submit">Save Changes</Button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-zinc-500" />
                  <span>{client.email || 'No email'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-zinc-500" />
                  <span>{client.phone || 'No phone'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-4 w-4 text-zinc-500" />
                  <span>{client.telegram_username ? `@${client.telegram_username}` : 'No Telegram'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  <span>Created: {new Date(client.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-400">Projects</span>
                <span className="font-medium">{client.project_count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Total Tasks</span>
                <span className="font-medium">{client.task_count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Active Tasks</span>
                <span className="font-medium text-blue-400">{client.active_task_count || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
