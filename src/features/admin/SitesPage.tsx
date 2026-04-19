import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Site, Company } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { MapPin, Plus, Pencil, Trash2, Building2 } from 'lucide-react';

export function SitesPage() {
  const { profile } = useAuth();
  const [sites, setSites] = useState<(Site & { company?: Company })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    let query = supabase.from('sites').select('*, company:companies(*)').order('created_at', { ascending: false });
    if (profile?.role === 'company_admin' && profile.company_id) {
      query = query.eq('company_id', profile.company_id);
    }
    const { data } = await query;
    setSites((data as any) || []);

    if (profile?.role === 'admin') {
      const { data: companyData } = await supabase.from('companies').select('*').order('name');
      setCompanies(companyData || []);
    } else if (profile?.company_id) {
      const { data: companyData } = await supabase.from('companies').select('*').eq('id', profile.company_id);
      setCompanies(companyData || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const cid = profile?.role === 'company_admin' ? profile.company_id! : companyId;

    if (editingSite) {
      await supabase.from('sites').update({ name, address, company_id: cid }).eq('id', editingSite.id);
    } else {
      await supabase.from('sites').insert({ name, address, company_id: cid });
    }

    setDialogOpen(false);
    setEditingSite(null);
    setName(''); setAddress(''); setCompanyId('');
    setSubmitting(false);
    fetchData();
  };

  const handleEdit = (site: Site) => {
    setEditingSite(site);
    setName(site.name);
    setAddress(site.address);
    setCompanyId(site.company_id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure? This will delete all cranes and data for this site.')) {
      await supabase.from('sites').delete().eq('id', id);
      fetchData();
    }
  };

  const openCreate = () => {
    setEditingSite(null);
    setName(''); setAddress(''); setCompanyId(profile?.company_id || '');
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sites</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage construction sites</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" />Add Site
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSite ? 'Edit Site' : 'Add Site'}</DialogTitle>
              <DialogDescription>
                {editingSite ? 'Update site details.' : 'Create a new construction site.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-1">
              {profile?.role === 'admin' && (
                <div className="space-y-1.5">
                  <Label>Company</Label>
                  <Select value={companyId} onValueChange={setCompanyId} required>
                    <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="site-name">Site Name</Label>
                <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter site name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="site-address">Address</Label>
                <Input id="site-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter site address" required />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Saving...' : editingSite ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : sites.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <MapPin className="h-7 w-7 text-emerald-600" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No sites yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first construction site.</p>
          <Button className="mt-5" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />Add Site
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((site) => (
            <div
              key={site.id}
              className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-4 flex items-center justify-between gap-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow group"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{site.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{site.address}</p>
                  {site.company && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Building2 className="h-3 w-3" />{site.company.name}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl"
                  onClick={() => handleEdit(site)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-xl text-destructive hover:text-destructive hover:bg-red-50"
                  onClick={() => handleDelete(site.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
