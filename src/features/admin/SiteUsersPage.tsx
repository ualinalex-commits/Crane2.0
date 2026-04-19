import React, { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile, Subcontractor, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Users, Plus, Pencil, Trash2, UserCircle, Building2, AlertCircle } from 'lucide-react';

const siteRoles: { value: UserRole; label: string }[] = [
  { value: 'crane_supervisor', label: 'Crane Supervisor' },
  { value: 'crane_operator', label: 'Crane Operator' },
  { value: 'slinger_signaller', label: 'Slinger Signaller' },
];

const roleLabels: Record<string, string> = {
  crane_supervisor: 'Crane Supervisor',
  crane_operator: 'Crane Operator',
  slinger_signaller: 'Slinger Signaller',
  subcontractor: 'Subcontractor',
  appointed_person: 'Appointed Person',
  company_admin: 'Company Admin',
  admin: 'Admin',
};

const roleBadgeColor: Record<string, string> = {
  crane_supervisor: 'bg-blue-50 text-blue-700',
  crane_operator:   'bg-orange-50 text-orange-700',
  slinger_signaller:'bg-purple-50 text-purple-700',
  subcontractor:    'bg-emerald-50 text-emerald-700',
  appointed_person: 'bg-primary/10 text-primary',
};

export function SiteUsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('crane_operator');
  const [userPassword, setUserPassword] = useState('');

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subcontractor | null>(null);
  const [subCompanyName, setSubCompanyName] = useState('');
  const [subContactName, setSubContactName] = useState('');
  const [subContactEmail, setSubContactEmail] = useState('');
  const [subPassword, setSubPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    if (!profile?.site_id) { setLoading(false); return; }
    const { data: userData } = await supabase
      .from('profiles')
      .select('*')
      .eq('site_id', profile.site_id)
      .in('role', ['crane_supervisor', 'crane_operator', 'slinger_signaller'])
      .order('full_name');
    setUsers(userData as Profile[] || []);

    const { data: subData } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('site_id', profile.site_id)
      .order('company_name');
    setSubcontractors(subData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile]);

  const handleCreateUser = async () => {
    if (!profile?.site_id || !profile?.company_id) {
      setError('Your profile is missing site or company assignment');
      return;
    }
    if (!editingUser && (!userEmail.trim() || !userFullName.trim() || !userPassword.trim())) {
      setError('All fields are required');
      return;
    }
    if (editingUser && !userFullName.trim()) {
      setError('Full name is required');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      if (editingUser) {
        const { error: updateErr } = await supabase.from('profiles').update({
          full_name: userFullName,
          role: userRole,
        }).eq('id', editingUser.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        if (!supabaseAdmin) {
          throw new Error('Admin client not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to .env');
        }
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: userEmail,
          password: userPassword,
          email_confirm: true,
          user_metadata: { full_name: userFullName, role: userRole },
        });
        if (authError) throw new Error(authError.message);

        if (authData.user) {
          const { error: profileErr } = await supabaseAdmin.from('profiles').update({
            role: userRole,
            company_id: profile.company_id,
            site_id: profile.site_id,
            full_name: userFullName,
          }).eq('user_id', authData.user.id);
          if (profileErr) throw new Error(profileErr.message);
        }
      }

      setUserDialogOpen(false);
      setEditingUser(null);
      setUserEmail(''); setUserFullName(''); setUserRole('crane_operator'); setUserPassword('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSub = async () => {
    if (!profile?.site_id || !profile?.company_id) {
      setError('Your profile is missing site or company assignment');
      return;
    }
    if (!editingSub && (!subCompanyName.trim() || !subContactName.trim() || !subContactEmail.trim() || !subPassword.trim())) {
      setError('All fields are required');
      return;
    }
    if (editingSub && (!subCompanyName.trim() || !subContactName.trim())) {
      setError('Company name and contact name are required');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      if (editingSub) {
        const { error: updateErr } = await supabase.from('subcontractors').update({
          company_name: subCompanyName,
          contact_name: subContactName,
          contact_email: subContactEmail,
        }).eq('id', editingSub.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        const { error: subErr } = await supabase.from('subcontractors').insert({
          site_id: profile.site_id,
          company_name: subCompanyName,
          contact_name: subContactName,
          contact_email: subContactEmail,
        });
        if (subErr) throw new Error(subErr.message);

        if (supabaseAdmin) {
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: subContactEmail,
            password: subPassword,
            email_confirm: true,
            user_metadata: { full_name: subContactName, role: 'subcontractor' },
          });
          if (authError) throw new Error(authError.message);

          if (authData.user) {
            await supabaseAdmin.from('profiles').update({
              role: 'subcontractor',
              company_id: profile.company_id,
              site_id: profile.site_id,
              subcontractor_company_name: subCompanyName,
              full_name: subContactName,
            }).eq('user_id', authData.user.id);
          }
        }
      }

      setSubDialogOpen(false);
      setEditingSub(null);
      setSubCompanyName(''); setSubContactName(''); setSubContactEmail(''); setSubPassword('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save subcontractor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Delete this user?')) {
      await supabase.from('profiles').delete().eq('id', userId);
      fetchData();
    }
  };

  const handleDeleteSub = async (subId: string) => {
    if (confirm('Delete this subcontractor?')) {
      await supabase.from('subcontractors').delete().eq('id', subId);
      fetchData();
    }
  };

  const ErrorBanner = ({ msg }: { msg: string }) => (
    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {msg}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Site Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage personnel and subcontractors</p>
      </div>

      {error && !userDialogOpen && !subDialogOpen && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm animate-slide-down">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-xs underline cursor-pointer">Dismiss</button>
        </div>
      )}

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="users" className="flex-1 sm:flex-initial">
            Site Users
            {users.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">{users.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="subcontractors" className="flex-1 sm:flex-initial">
            Subcontractors
            {subcontractors.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">{subcontractors.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Site Users Tab ─────────────────────────────────────────────── */}
        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => {
              setEditingUser(null); setUserEmail(''); setUserFullName('');
              setUserRole('crane_operator'); setUserPassword(''); setError('');
              setUserDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-1" />Add User
            </Button>
          </div>

          <Dialog open={userDialogOpen} onOpenChange={(open) => { setUserDialogOpen(open); if (!open) setError(''); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Edit User' : 'Add Site User'}</DialogTitle>
                <DialogDescription>
                  {editingUser ? 'Update user details.' : 'Create a new site user account.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-1">
                {error && <ErrorBanner msg={error} />}
                {!editingUser && (
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="user@example.com" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input value={userFullName} onChange={(e) => setUserFullName(e.target.value)} placeholder="John Smith" />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={userRole} onValueChange={(v) => setUserRole(v as UserRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {siteRoles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!editingUser && (
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Min 6 characters" />
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
                  <Button disabled={submitting} onClick={handleCreateUser}>
                    {submitting ? 'Saving...' : editingUser ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No site users yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Add operators, supervisors, and signallers.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-4 flex items-center justify-between gap-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <UserCircle className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{u.full_name}</h3>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <span className={`ml-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${roleBadgeColor[u.role] || 'bg-muted text-muted-foreground'}`}>
                      {roleLabels[u.role]}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl"
                      onClick={() => {
                        setEditingUser(u); setUserFullName(u.full_name);
                        setUserRole(u.role); setError(''); setUserDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl text-destructive hover:text-destructive hover:bg-red-50"
                      onClick={() => handleDeleteUser(u.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Subcontractors Tab ─────────────────────────────────────────── */}
        <TabsContent value="subcontractors" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => {
              setEditingSub(null); setSubCompanyName(''); setSubContactName('');
              setSubContactEmail(''); setSubPassword(''); setError('');
              setSubDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-1" />Add Subcontractor
            </Button>
          </div>

          <Dialog open={subDialogOpen} onOpenChange={(open) => { setSubDialogOpen(open); if (!open) setError(''); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSub ? 'Edit Subcontractor' : 'Add Subcontractor'}</DialogTitle>
                <DialogDescription>
                  {editingSub ? 'Update subcontractor details.' : 'Register a new subcontractor for this site.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-1">
                {error && <ErrorBanner msg={error} />}
                <div className="space-y-1.5">
                  <Label>Company Name</Label>
                  <Input value={subCompanyName} onChange={(e) => setSubCompanyName(e.target.value)} placeholder="Subcontractor Co. Ltd" />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Name</Label>
                  <Input value={subContactName} onChange={(e) => setSubContactName(e.target.value)} placeholder="Contact person" />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Email</Label>
                  <Input type="email" value={subContactEmail} onChange={(e) => setSubContactEmail(e.target.value)} placeholder="contact@sub.com" disabled={!!editingSub} />
                </div>
                {!editingSub && (
                  <div className="space-y-1.5">
                    <Label>Password</Label>
                    <Input type="password" value={subPassword} onChange={(e) => setSubPassword(e.target.value)} placeholder="Min 6 characters" />
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSubDialogOpen(false)}>Cancel</Button>
                  <Button disabled={submitting} onClick={handleCreateSub}>
                    {submitting ? 'Saving...' : editingSub ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : subcontractors.length === 0 ? (
            <div className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
                <Building2 className="h-7 w-7 text-purple-600" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No subcontractors yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Register subcontractors for crane bookings.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subcontractors.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-4 flex items-center justify-between gap-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{sub.company_name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sub.contact_name} · {sub.contact_email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl"
                      onClick={() => {
                        setEditingSub(sub); setSubCompanyName(sub.company_name);
                        setSubContactName(sub.contact_name); setSubContactEmail(sub.contact_email);
                        setError(''); setSubDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-xl text-destructive hover:text-destructive hover:bg-red-50"
                      onClick={() => handleDeleteSub(sub.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
