import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Site, Company } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sites</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage construction sites</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Site</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSite ? 'Edit Site' : 'Add Site'}</DialogTitle>
              <DialogDescription>{editingSite ? 'Update site details.' : 'Create a new construction site.'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {profile?.role === 'admin' && (
                <div className="space-y-2">
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
              <div className="space-y-2">
                <Label htmlFor="site-name">Site Name</Label>
                <Input id="site-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter site name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site-address">Address</Label>
                <Input id="site-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter site address" required />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : editingSite ? 'Update' : 'Create'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : sites.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MapPin className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">No sites yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first construction site.</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Site</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sites.map((site) => (
            <Card key={site.id} className="group hover:border-primary/20 transition-all duration-200">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{site.name}</h3>
                    <p className="text-xs text-muted-foreground">{site.address}</p>
                    {site.company && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" />{site.company.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(site)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(site.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
