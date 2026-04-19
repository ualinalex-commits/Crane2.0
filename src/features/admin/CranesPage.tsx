import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Crane } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Construction as CraneIcon, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';

export function CranesPage() {
  const { profile } = useAuth();
  const [cranes, setCranes] = useState<Crane[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCrane, setEditingCrane] = useState<Crane | null>(null);
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [capacity, setCapacity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchCranes = async () => {
    if (!profile?.site_id) { setLoading(false); return; }
    const { data } = await supabase.from('cranes').select('*').eq('site_id', profile.site_id).order('created_at', { ascending: false });
    setCranes(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchCranes(); }, [profile]);

  const handleSubmit = async () => {
    if (!name.trim() || !model.trim() || !capacity.trim()) {
      setError('All fields are required');
      return;
    }
    if (!profile?.site_id) {
      setError('No site assigned to your profile');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      if (editingCrane) {
        const { error: updateErr } = await supabase.from('cranes').update({ name, model, capacity }).eq('id', editingCrane.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        const { error: insertErr } = await supabase.from('cranes').insert({ name, model, capacity, site_id: profile.site_id });
        if (insertErr) throw new Error(insertErr.message);
      }

      setDialogOpen(false);
      setEditingCrane(null);
      setName(''); setModel(''); setCapacity('');
      fetchCranes();
    } catch (err: any) {
      setError(err.message || 'Failed to save crane');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (crane: Crane) => {
    setEditingCrane(crane);
    setName(crane.name); setModel(crane.model); setCapacity(crane.capacity);
    setError('');
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this crane?')) {
      await supabase.from('cranes').delete().eq('id', id);
      fetchCranes();
    }
  };

  const openCreate = () => {
    setEditingCrane(null);
    setName(''); setModel(''); setCapacity('');
    setError('');
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cranes</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage cranes on your site</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Crane</Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCrane ? 'Edit Crane' : 'Add Crane'}</DialogTitle>
            <DialogDescription>{editingCrane ? 'Update crane details.' : 'Add a new crane to the site.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="crane-name">Crane Name</Label>
              <Input id="crane-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tower Crane 1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crane-model">Model</Label>
              <Input id="crane-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Liebherr 280 EC-H" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="crane-capacity">Capacity</Label>
              <Input id="crane-capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="e.g. 12 tonnes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="button" disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Saving...' : editingCrane ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : cranes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CraneIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">No cranes yet</h3>
            <p className="text-sm text-muted-foreground mt-1">Add cranes to your site.</p>
            <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Crane</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cranes.map((crane) => (
            <Card key={crane.id} className="group hover:border-primary/20 transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <CraneIcon className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{crane.name}</h3>
                      <p className="text-xs text-muted-foreground">{crane.model}</p>
                      <p className="text-xs text-muted-foreground">Capacity: {crane.capacity}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(crane)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(crane.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
