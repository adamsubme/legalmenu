"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Search, Shield, CheckCircle, XCircle } from "lucide-react";

interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "mod" | "company" | "client";
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

const ROLES = [
  { value: "admin", label: "Admin", color: "text-red-400", bg: "bg-red-500/10" },
  { value: "mod", label: "Moderator", color: "text-orange-400", bg: "bg-orange-500/10" },
  { value: "company", label: "Company", color: "text-blue-400", bg: "bg-blue-500/10" },
  { value: "client", label: "Client", color: "text-emerald-400", bg: "bg-emerald-500/10" },
];

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "client" });
  const [modalError, setModalError] = useState("");

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/users");
      if (res.ok) { const data = await res.json(); setUsers(data.users); }
      else { setError("Failed to load users"); }
    } catch { setError("Connection error"); }
    finally { setLoading(false); }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setModalError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (res.ok) { setShowModal(false); setNewUser({ name: "", email: "", password: "", role: "client" }); fetchUsers(); }
      else { const data = await res.json(); setModalError(data.error || "Failed to create user"); }
    } catch { setModalError("Connection error"); }
  }

  async function toggleUserStatus(user: User) {
    try {
      await fetch("/api/users/" + user.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      fetchUsers();
    } catch { console.error("Failed to toggle user status"); }
  }

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  });

  function getRoleBadge(role: string) {
    const r = ROLES.find((r) => r.value === role);
    if (!r) return null;
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${r.bg} ${r.color}`}><Shield className="h-3 w-3" />{r.label}</span>;
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-center mb-6">
        <div><h1 className="text-2xl font-bold text-zinc-100">User Management</h1><p className="text-sm text-zinc-400 mt-1">Manage accounts and permissions</p></div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 ml-4"><Plus className="h-4 w-4" />Add User</button>
      </div>
      {error && <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-sm">{error}</div>}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full h-10 pl-10 rounded-lg border border-zinc-700 bg-zinc-900 text-sm text-zinc-100" />
        </div>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="h-10 px-3 rounded-lg border border-zinc-700 bg-zinc-900 text-sm text-zinc-100">
          <option value="">All Roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-zinc-800">
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">User</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Role</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Status</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500">Created</th>
            <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500">Actions</th>
          </tr></thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-medium text-zinc-400">{user.name.charAt(0).toUpperCase()}</div><div><p className="text-sm font-medium text-zinc-100">{user.name}</p><p className="text-xs text-zinc-500">{user.email}</p></div></div></td>
                <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                <td className="px-4 py-3">{user.is_active ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="h-3 w-3" />Active</span> : <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><XCircle className="h-3 w-3" />Inactive</span>}</td>
                <td className="px-4 py-3 text-sm text-zinc-500">{new Date(user.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3"><div className="flex justify-end"><button onClick={() => toggleUserStatus(user)} className={`px-3 py-1 rounded text-xs font-medium ${user.is_active ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>{user.is_active ? "Deactivate" : "Activate"}</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && <div className="p-8 text-center text-zinc-500"><Users className="h-8 w-8 mx-auto mb-2 opacity-50" /><p>No users found</p></div>}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-zinc-100 mb-4">Add New User</h2>
            {modalError && <div className="mb-4 p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-sm">{modalError}</div>}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div><label className="block text-xs font-medium text-zinc-400 mb-1.5">Full Name</label><input type="text" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100" required /></div>
              <div><label className="block text-xs font-medium text-zinc-400 mb-1.5">Email</label><input type="email" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100" required /></div>
              <div><label className="block text-xs font-medium text-zinc-400 mb-1.5">Password</label><input type="password" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100" required minLength={6} /></div>
              <div><label className="block text-xs font-medium text-zinc-400 mb-1.5">Role</label><select value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value as any})} className="w-full h-10 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100">{ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="flex-1 h-10 rounded-lg border border-zinc-700 text-sm text-zinc-400">Cancel</button><button type="submit" className="flex-1 h-10 rounded-lg bg-blue-600 text-sm font-medium text-white">Create User</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
