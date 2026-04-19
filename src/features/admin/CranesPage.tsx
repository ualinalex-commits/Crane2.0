import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Crane } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Construction as CraneIcon, Plus, Pencil, Trash2, AlertCircle, Weight } from 'lucide-react';

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
    const { data } = await supabase
      .from('cranes')
      .select('*')
      .eq('site_id', profile.site_id)
      .order('created_at', { ascending: false });
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
        const { error: updateErr } = await supabase
          .from('cranes')
          .update({ name, model, capacity })
          .eq('id', editingCrane.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        const { error: insertErr } = await supabase
          .from('cranes')
          .insert({ name, model, capacity, site_id: profile.site_id });
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
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cranes</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage cranes on your site</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />Add Crane
        </Button>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCrane ? 'Edit Crane' : 'Add Crane'}</DialogTitle>
            <DialogDescription>
              {editingCrane ? 'Update crane details.' : 'Add a new crane to the site.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            {error && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="crane-name">Crane Name</Label>
              <Input
                id="crane-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tower Crane 1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crane-model">Model</Label>
              <Input
                id="crane-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. Liebherr 280 EC-H"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crane-capacity">Capacity</Label>
              <Input
                id="crane-capacity"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 12 tonnes"
              />
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
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : cranes.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-12 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
            <CraneIcon className="h-7 w-7 text-orange-600" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No cranes yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Add cranes to your site.</p>
          <Button className="mt-5" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" />Add Crane
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cranes.map((crane) => (
            <div
              key={crane.id}
              className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <CraneIcon className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{crane.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{crane.model}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Weight className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{crane.capacity}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl"
                    onClick={() => handleEdit(crane)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-destructive hover:text-destructive hover:bg-red-50"
                    onClick={() => handleDelete(crane.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
