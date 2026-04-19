import React, { useEffect, useState } from 'react';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile, Subcontractor, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
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

export function SiteUsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // User dialog
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('crane_operator');
  const [userPassword, setUserPassword] = useState('');

  // Subcontractor dialog
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Site Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage personnel and subcontractors</p>
      </div>

      {error && !userDialogOpen && !subDialogOpen && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-slide-down">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-xs underline cursor-pointer">Dismiss</button>
        </div>
      )}

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="users" className="flex-1 sm:flex-initial">Site Users</TabsTrigger>
          <TabsTrigger value="subcontractors" className="flex-1 sm:flex-initial">Subcontractors</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => {
              setEditingUser(null); setUserEmail(''); setUserFullName('');
              setUserRole('crane_operator'); setUserPassword(''); setError('');
              setUserDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />Add User
            </Button>
          </div>

          {/* Add User Dialog */}
          <Dialog open={userDialogOpen} onOpenChange={(open) => { setUserDialogOpen(open); if (!open) setError(''); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Edit User' : 'Add Site User'}</DialogTitle>
                <DialogDescription>
                  {editingUser ? 'Update user details.' : 'Create a new site user account.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}
                {!editingUser && (
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="user@example.com" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={userFullName} onChange={(e) => setUserFullName(e.target.value)} placeholder="John Smith" />
                </div>
                <div className="space-y-2">
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
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Min 6 characters" />
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
                  <Button type="button" disabled={submitting} onClick={handleCreateUser}>
                    {submitting ? 'Saving...' : editingUser ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground">No site users yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Add operators, supervisors, and signallers.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {users.map((u) => (
                <Card key={u.id} className="group hover:border-primary/20 transition-all duration-200">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                        <UserCircle className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{u.full_name}</h3>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <Badge variant="secondary" className="ml-2">{roleLabels[u.role]}</Badge>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setEditingUser(u); setUserFullName(u.full_name); setUserRole(u.role); setError(''); setUserDialogOpen(true);
                      }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteUser(u.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="subcontractors" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => {
              setEditingSub(null); setSubCompanyName(''); setSubContactName('');
              setSubContactEmail(''); setSubPassword(''); setError('');
              setSubDialogOpen(true);
            }}>
              <Plus className="h-4 w-4 mr-2" />Add Subcontractor
            </Button>
          </div>

          {/* Add Subcontractor Dialog */}
          <Dialog open={subDialogOpen} onOpenChange={(open) => { setSubDialogOpen(open); if (!open) setError(''); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSub ? 'Edit Subcontractor' : 'Add Subcontractor'}</DialogTitle>
                <DialogDescription>
                  {editingSub ? 'Update subcontractor details.' : 'Register a new subcontractor for this site.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={subCompanyName} onChange={(e) => setSubCompanyName(e.target.value)} placeholder="Subcontractor Co. Ltd" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input value={subContactName} onChange={(e) => setSubContactName(e.target.value)} placeholder="Contact person" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input type="email" value={subContactEmail} onChange={(e) => setSubContactEmail(e.target.value)} placeholder="contact@sub.com" disabled={!!editingSub} />
                </div>
                {!editingSub && (
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" value={subPassword} onChange={(e) => setSubPassword(e.target.value)} placeholder="Min 6 characters" />
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setSubDialogOpen(false)}>Cancel</Button>
                  <Button type="button" disabled={submitting} onClick={handleCreateSub}>
                    {submitting ? 'Saving...' : editingSub ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : subcontractors.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground">No subcontractors yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Register subcontractors for crane bookings.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {subcontractors.map((sub) => (
                <Card key={sub.id} className="group hover:border-primary/20 transition-all duration-200">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{sub.company_name}</h3>
                        <p className="text-xs text-muted-foreground">{sub.contact_name} • {sub.contact_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        setEditingSub(sub); setSubCompanyName(sub.company_name); setSubContactName(sub.contact_name);
                        setSubContactEmail(sub.contact_email); setError(''); setSubDialogOpen(true);
                      }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteSub(sub.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
