'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Save, RotateCcw, FolderOpen, Link as LinkIcon, Users, Shield, UserPlus, Trash2, Edit2 } from 'lucide-react';
import { getConfig, updateConfig, resetConfig, type MissionControlConfig } from '@/lib/config';

type UserRole = 'admin' | 'mod' | 'company' | 'client';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<MissionControlConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'client' as UserRole });
  const [userError, setUserError] = useState('');
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);

  useEffect(() => {
    setConfig(getConfig());
    loadCurrentUser();
    loadUsers();
  }, []);

  async function loadCurrentUser() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      }
    } catch { /* ignore */ }
  }

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch { /* ignore */ }
    setUsersLoading(false);
  }

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      updateConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults?')) {
      resetConfig();
      setConfig(getConfig());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleChange = (field: keyof MissionControlConfig, value: string) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setUserError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
        credentials: 'include',
      });
      if (res.ok) {
        setShowCreateUser(false);
        setNewUser({ name: '', email: '', password: '', role: 'client' });
        loadUsers();
      } else {
        const data = await res.json();
        setUserError(data.error || 'Failed to create user');
      }
    } catch { setUserError('Failed to create user'); }
  }

  async function handleDeleteUser(user: User) {
    if (!confirm(`Deactivate user "${user.name}"?`)) return;
    try {
      await fetch(`/api/users/${user.id}`, { method: 'DELETE', credentials: 'include' });
      loadUsers();
    } catch { /* ignore */ }
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setUserError('');
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingUser.name, role: editingUser.role }),
        credentials: 'include',
      });
      if (res.ok) {
        setEditingUser(null);
        loadUsers();
      } else {
        const data = await res.json();
        setUserError(data.error || 'Failed to update user');
      }
    } catch { setUserError('Failed to update user'); }
  }

  const isAdmin = currentUser?.role === 'admin';

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-red-500/10 text-red-400 border-red-500/30',
    mod: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    company: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    client: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  };

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--mc-bg)', color: 'var(--mc-text)' }}>
        Loading settings...
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--mc-bg)', color: 'var(--mc-text)' }}>
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ borderColor: 'var(--mc-border)', backgroundColor: 'var(--mc-bg-secondary)' }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')} className="text-sm px-2 py-1 rounded hover:bg-opacity-10" style={{ color: 'var(--mc-text-secondary)' }}>
              ← Back
            </button>
            <Settings className="w-5 h-5" style={{ color: 'var(--mc-accent)' }} />
            <h1 className="text-xl font-bold">Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleReset} className="px-3 py-1.5 text-sm border rounded flex items-center gap-2 hover:opacity-80" style={{ borderColor: 'var(--mc-border)', color: 'var(--mc-text-secondary)' }}>
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button onClick={handleSave} disabled={isSaving} className="px-3 py-1.5 text-sm rounded flex items-center gap-2 hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: 'var(--mc-accent)', color: '#fff' }}>
              <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Success/Error */}
        {saveSuccess && (
          <div className="p-4 rounded text-sm" style={{ backgroundColor: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
            Settings saved successfully
          </div>
        )}
        {error && (
          <div className="p-4 rounded text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* Workspace Paths */}
        <section className="p-6 rounded-lg border" style={{ backgroundColor: 'var(--mc-bg-secondary)', borderColor: 'var(--mc-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5" style={{ color: 'var(--mc-accent)' }} />
            <h2 className="text-lg font-semibold">Workspace Paths</h2>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--mc-text-secondary)' }}>
            Configure where Mission Control stores projects and deliverables.
          </p>
          <div className="space-y-4">
            {['workspaceBasePath', 'projectsPath', 'defaultProjectName'].map((field) => (
              <div key={field}>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--mc-text)' }}>
                  {field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                </label>
                <input
                  type="text"
                  value={(config as Record<string,string>)[field] || ''}
                  onChange={(e) => handleChange(field as keyof MissionControlConfig, e.target.value)}
                  className="w-full px-4 py-2 rounded border text-sm"
                  style={{ backgroundColor: 'var(--mc-bg)', borderColor: 'var(--mc-border)', color: 'var(--mc-text)' }}
                />
              </div>
            ))}
          </div>
        </section>

        {/* API Configuration */}
        <section className="p-6 rounded-lg border" style={{ backgroundColor: 'var(--mc-bg-secondary)', borderColor: 'var(--mc-border)' }}>
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="w-5 h-5" style={{ color: 'var(--mc-accent)' }} />
            <h2 className="text-lg font-semibold">API Configuration</h2>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--mc-text-secondary)' }}>
            Mission Control API URL for agent orchestration.
          </p>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--mc-text)' }}>Mission Control URL</label>
            <input
              type="text"
              value={config.missionControlUrl}
              onChange={(e) => handleChange('missionControlUrl', e.target.value)}
              className="w-full px-4 py-2 rounded border text-sm"
              style={{ backgroundColor: 'var(--mc-bg)', borderColor: 'var(--mc-border)', color: 'var(--mc-text)' }}
            />
          </div>
        </section>

        {/* User Management */}
        {isAdmin && (
          <section className="p-6 rounded-lg border" style={{ backgroundColor: 'var(--mc-bg-secondary)', borderColor: 'var(--mc-border)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" style={{ color: 'var(--mc-accent)' }} />
                <h2 className="text-lg font-semibold">User Management</h2>
                <Shield className="w-4 h-4" style={{ color: 'var(--mc-accent)' }} />
                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#f87171' }}>Admin</span>
              </div>
              <button
                onClick={() => setShowCreateUser(true)}
                className="px-3 py-1.5 text-sm rounded flex items-center gap-2 hover:opacity-90"
                style={{ backgroundColor: 'var(--mc-accent)', color: '#fff' }}
              >
                <UserPlus className="w-4 h-4" /> New User
              </button>
            </div>

            {/* Create user form */}
            {showCreateUser && (
              <form onSubmit={handleCreateUser} className="mb-6 p-4 rounded border" style={{ backgroundColor: 'var(--mc-bg)', borderColor: 'var(--mc-accent)', borderWidth: '1px' }}>
                <h3 className="text-sm font-semibold mb-3">Create New User</h3>
                {userError && <p className="text-xs mb-3" style={{ color: '#f87171' }}>{userError}</p>}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input required placeholder="Full Name" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--mc-bg)', borderColor: 'var(--mc-border)', color: 'var(--mc-text)' }} />
                  <input required type="email" placeholder="Email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--mc-bg)', borderColor: 'var(--mc-border)', color: 'var(--mc-text)' }} />
                  <input required type="password" placeholder="Password (min 6 chars)" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--mc-bg)', borderColor: 'var(--mc-border)', color: 'var(--mc-text)' }} />
                  <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} className="px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--mc-bg)', borderColor: 'var(--mc-border)', color: 'var(--mc-text)' }}>
                    <option value="client">Client</option>
                    <option value="company">Company</option>
                    <option value="mod">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-1.5 text-sm rounded" style={{ backgroundColor: 'var(--mc-accent)', color: '#fff' }}>Create</button>
                  <button type="button" onClick={() => setShowCreateUser(false)} className="px-4 py-1.5 text-sm border rounded" style={{ borderColor: 'var(--mc-border)', color: 'var(--mc-text-secondary)' }}>Cancel</button>
                </div>
              </form>
            )}

            {/* Edit user form */}
            {editingUser && (
              <form onSubmit={handleUpdateUser} className="mb-6 p-4 rounded border" style={{ backgroundColor: 'var(--mc-bg)', borderColor: 'rgba(59,130,246,0.3)', borderWidth: '1px' }}>
                <h3 className="text-sm font-semibold mb-3">Edit User: {editingUser.email}</h3>
                {userError && <p className="text-xs mb-3" style={{ color: '#f87171' }}>{userError}</p>}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input required placeholder="Full Name" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--mc-bg)', borderColor: 'var(--mc-border)', color: 'var(--mc-text)' }} />
                  <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})} className="px-3 py-2 rounded border text-sm" style={{ backgroundColor: 'var(--mc-bg)', borderColor: 'var(--mc-border)', color: 'var(--mc-text)' }}>
                    <option value="client">Client</option>
                    <option value="company">Company</option>
                    <option value="mod">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-1.5 text-sm rounded" style={{ backgroundColor: 'var(--mc-accent)', color: '#fff' }}>Save</button>
                  <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-1.5 text-sm border rounded" style={{ borderColor: 'var(--mc-border)', color: 'var(--mc-text-secondary)' }}>Cancel</button>
                </div>
              </form>
            )}

            {/* Users table */}
            {usersLoading ? (
              <p className="text-sm" style={{ color: 'var(--mc-text-secondary)' }}>Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--mc-text-secondary)' }}>No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--mc-border)' }}>
                      <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--mc-text-secondary)' }}>Name</th>
                      <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--mc-text-secondary)' }}>Email</th>
                      <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--mc-text-secondary)' }}>Role</th>
                      <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--mc-text-secondary)' }}>Status</th>
                      <th className="text-left py-2 px-3 font-medium" style={{ color: 'var(--mc-text-secondary)' }}>Last Login</th>
                      <th className="text-right py-2 px-3 font-medium" style={{ color: 'var(--mc-text-secondary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-b" style={{ borderColor: 'var(--mc-border)' }}>
                        <td className="py-2 px-3">{user.name}</td>
                        <td className="py-2 px-3" style={{ color: 'var(--mc-text-secondary)' }}>{user.email}</td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${roleColors[user.role] || ''}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded ${user.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-500'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-xs" style={{ color: 'var(--mc-text-secondary)' }}>
                          {user.last_login ? new Date(user.last_login).toLocaleDateString('pl-PL') : '—'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button onClick={() => setEditingUser(user)} className="p-1.5 rounded hover:opacity-70" title="Edit">
                            <Edit2 className="w-4 h-4" style={{ color: 'var(--mc-accent)' }} />
                          </button>
                          {user.role !== 'admin' && (
                            <button onClick={() => handleDeleteUser(user)} className="p-1.5 rounded hover:opacity-70 ml-1" title="Deactivate">
                              <Trash2 className="w-4 h-4" style={{ color: '#f87171' }} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {!isAdmin && (
          <section className="p-6 rounded-lg border" style={{ backgroundColor: 'var(--mc-bg-secondary)', borderColor: 'var(--mc-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5" style={{ color: 'var(--mc-text-secondary)' }} />
              <h2 className="text-lg font-semibold">User Management</h2>
            </div>
            <p className="text-sm" style={{ color: 'var(--mc-text-secondary)' }}>
              Only administrators can manage users. Your current role: <strong>{currentUser?.role}</strong>
            </p>
          </section>
        )}

        {/* Environment Variables Note */}
        <section className="p-6 rounded-lg border" style={{ backgroundColor: 'rgba(59,130,246,0.05)', borderColor: 'rgba(59,130,246,0.3)' }}>
          <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--mc-accent)' }}>Environment Variables</h3>
          <p className="text-sm mb-3" style={{ color: 'var(--mc-text-secondary)' }}>
            Some settings require <code className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--mc-bg)' }}>.env.local</code>:
          </p>
          <ul className="text-sm space-y-1 ml-4 list-disc" style={{ color: 'var(--mc-text-secondary)' }}>
            <li><code className="text-xs">MISSION_CONTROL_URL</code> — API URL</li>
            <li><code className="text-xs">WORKSPACE_BASE_PATH</code> — Workspace directory</li>
            <li><code className="text-xs">OPENCLAW_GATEWAY_URL</code> — Gateway WebSocket URL</li>
            <li><code className="text-xs">OPENCLAW_GATEWAY_TOKEN</code> — Gateway auth token</li>
            <li><code className="text-xs">SESSION_SECRET</code> — Session signing key</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
