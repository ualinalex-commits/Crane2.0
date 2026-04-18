import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
  DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Users, Plus, Pencil, Trash2, UserCircle, Building2 } from 'lucide-react';

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.site_id || !profile?.company_id) return;
    setSubmitting(true);

    if (editingUser) {
      await supabase.from('profiles').update({
        full_name: userFullName,
        role: userRole,
      }).eq('id', editingUser.id);
    } else {
      // Create auth user then profile
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userEmail,
        password: userPassword,
        options: { data: { full_name: userFullName, role: userRole } }
      });
      if (!authError && authData.user) {
        await supabase.from('profiles').insert({
          user_id: authData.user.id,
          email: userEmail,
          full_name: userFullName,
          role: userRole,
          company_id: profile.company_id,
          site_id: profile.site_id,
        });
      }
    }

    setUserDialogOpen(false); setEditingUser(null);
    setUserEmail(''); setUserFullName(''); setUserRole('crane_operator'); setUserPassword('');
    setSubmitting(false);
    fetchData();
  };

  const handleCreateSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.site_id || !profile?.company_id) return;
    setSubmitting(true);

    if (editingSub) {
      await supabase.from('subcontractors').update({
        company_name: subCompanyName,
        contact_name: subContactName,
        contact_email: subContactEmail,
      }).eq('id', editingSub.id);
    } else {
      // Create subcontractor entry
      await supabase.from('subcontractors').insert({
        site_id: profile.site_id,
        company_name: subCompanyName,
        contact_name: subContactName,
        contact_email: subContactEmail,
      });

      // Create auth user for subcontractor
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: subContactEmail,
        password: subPassword,
        options: { data: { full_name: subContactName, role: 'subcontractor' } }
      });
      if (!authError && authData.user) {
        await supabase.from('profiles').insert({
          user_id: authData.user.id,
          email: subContactEmail,
          full_name: subContactName,
          role: 'subcontractor',
          company_id: profile.company_id,
          site_id: profile.site_id,
          subcontractor_company_name: subCompanyName,
        });
      }
    }

    setSubDialogOpen(false); setEditingSub(null);
    setSubCompanyName(''); setSubContactName(''); setSubContactEmail(''); setSubPassword('');
    setSubmitting(false);
    fetchData();
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

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="users" className="flex-1 sm:flex-initial">Site Users</TabsTrigger>
          <TabsTrigger value="subcontractors" className="flex-1 sm:flex-initial">Subcontractors</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingUser(null); setUserEmail(''); setUserFullName(''); setUserRole('crane_operator'); setUserPassword(''); }}>
                  <Plus className="h-4 w-4 mr-2" />Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingUser ? 'Edit User' : 'Add Site User'}</DialogTitle>
                  <DialogDescription>
                    {editingUser ? 'Update user details.' : 'Create a new site user account.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  {!editingUser && (
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="user@example.com" required />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input value={userFullName} onChange={(e) => setUserFullName(e.target.value)} placeholder="John Smith" required />
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
                      <Input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : editingUser ? 'Update' : 'Create'}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

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
                        setEditingUser(u); setUserFullName(u.full_name); setUserRole(u.role); setUserDialogOpen(true);
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
            <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingSub(null); setSubCompanyName(''); setSubContactName(''); setSubContactEmail(''); setSubPassword(''); }}>
                  <Plus className="h-4 w-4 mr-2" />Add Subcontractor
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingSub ? 'Edit Subcontractor' : 'Add Subcontractor'}</DialogTitle>
                  <DialogDescription>
                    {editingSub ? 'Update subcontractor details.' : 'Register a new subcontractor for this site.'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateSub} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input value={subCompanyName} onChange={(e) => setSubCompanyName(e.target.value)} placeholder="Subcontractor Co. Ltd" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Name</Label>
                    <Input value={subContactName} onChange={(e) => setSubContactName(e.target.value)} placeholder="Contact person" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input type="email" value={subContactEmail} onChange={(e) => setSubContactEmail(e.target.value)} placeholder="contact@sub.com" required disabled={!!editingSub} />
                  </div>
                  {!editingSub && (
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input type="password" value={subPassword} onChange={(e) => setSubPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
                    </div>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setSubDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : editingSub ? 'Update' : 'Create'}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

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
                        setEditingSub(sub); setSubCompanyName(sub.company_name); setSubContactName(sub.contact_name); setSubContactEmail(sub.contact_email); setSubDialogOpen(true);
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
