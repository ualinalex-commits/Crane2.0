import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Crane, CraneLog, CraneStatus, Subcontractor } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import {
  ClipboardList, Plus, Pencil, Lock, Clock, AlertCircle
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

const statusOptions: CraneStatus[] = [
  'Working', 'Service', 'Thorough Examination', 'Breaking Down', 'Winded Off'
];

const statusColors: Record<CraneStatus, string> = {
  'Working': 'bg-emerald-500/20 text-emerald-400',
  'Service': 'bg-blue-500/20 text-blue-400',
  'Thorough Examination': 'bg-purple-500/20 text-purple-400',
  'Breaking Down': 'bg-red-500/20 text-red-400',
  'Winded Off': 'bg-amber-500/20 text-amber-400',
};

export default function CraneLogsPage() {
  const { profile } = useAuth();
  const [cranes, setCranes] = useState<Crane[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [openLogs, setOpenLogs] = useState<CraneLog[]>([]);
  const [closedLogs, setClosedLogs] = useState<CraneLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<CraneLog | null>(null);
  const [selectedCrane, setSelectedCrane] = useState('');
  const [status, setStatus] = useState<CraneStatus>('Working');
  const [jobDetails, setJobDetails] = useState('');
  const [selectedSubcontractor, setSelectedSubcontractor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Track which cranes have open logs
  const [cranesWithOpenLogs, setCranesWithOpenLogs] = useState<Set<string>>(new Set());

  const canCreateLogs = profile?.role === 'crane_operator' || profile?.role === 'crane_supervisor';
  const canEditClosedLogs = profile?.role === 'appointed_person';
  const canCloseLogs = profile?.role === 'crane_operator' || profile?.role === 'crane_supervisor' || profile?.role === 'appointed_person';

  const fetchData = async () => {
    if (!profile?.site_id) { setLoading(false); return; }

    const [cranesRes, subsRes, openLogsRes, closedLogsRes] = await Promise.all([
      supabase.from('cranes').select('*').eq('site_id', profile.site_id).order('name'),
      supabase.from('subcontractors').select('*').eq('site_id', profile.site_id).order('company_name'),
      supabase.from('crane_logs').select('*, crane:cranes(*), subcontractor:subcontractors(*)').eq('site_id', profile.site_id).eq('is_open', true).order('start_time', { ascending: false }),
      supabase.from('crane_logs').select('*, crane:cranes(*), subcontractor:subcontractors(*)').eq('site_id', profile.site_id).eq('is_open', false).order('end_time', { ascending: false }).limit(50),
    ]);

    setCranes(cranesRes.data || []);
    setSubcontractors(subsRes.data || []);
    setOpenLogs(openLogsRes.data as any || []);
    setClosedLogs(closedLogsRes.data as any || []);

    const openCraneIds = new Set((openLogsRes.data || []).map((l: any) => l.crane_id));
    setCranesWithOpenLogs(openCraneIds);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile]);

  const handleCreateLog = async () => {
    if (!profile?.site_id || !profile?.user_id) {
      setError('Profile is missing site assignment');
      return;
    }
    if (!editingLog && !selectedCrane) {
      setError('Please select a crane');
      return;
    }
    if (!jobDetails.trim()) {
      setError('Job details are required');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      if (editingLog) {
        const updateData: Record<string, unknown> = {
          status,
          job_details: jobDetails,
          subcontractor_id: status === 'Working' ? selectedSubcontractor || null : null,
          updated_at: new Date().toISOString(),
        };
        const { error: updateErr } = await supabase.from('crane_logs').update(updateData).eq('id', editingLog.id);
        if (updateErr) throw new Error(updateErr.message);
      } else {
        const { error: insertErr } = await supabase.from('crane_logs').insert({
          crane_id: selectedCrane,
          site_id: profile.site_id,
          created_by: profile.user_id,
          status,
          job_details: jobDetails,
          subcontractor_id: status === 'Working' ? selectedSubcontractor || null : null,
          start_time: new Date().toISOString(),
          is_open: true,
        });
        if (insertErr) throw new Error(insertErr.message);
      }
      setDialogOpen(false);
      setEditingLog(null);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to save log');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseLog = async (logId: string) => {
    if (!profile?.user_id) return;
    await supabase.from('crane_logs').update({
      is_open: false,
      end_time: new Date().toISOString(),
      closed_by: profile.user_id,
      updated_at: new Date().toISOString(),
    }).eq('id', logId);
    fetchData();
  };

  const openEditDialog = (log: CraneLog) => {
    setEditingLog(log);
    setSelectedCrane(log.crane_id);
    setStatus(log.status);
    setJobDetails(log.job_details);
    setSelectedSubcontractor(log.subcontractor_id || '');
    setError('');
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingLog(null);
    resetForm();
    setError('');
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedCrane('');
    setStatus('Working');
    setJobDetails('');
    setSelectedSubcontractor('');
  };

  const selectedCraneHasOpenLog = cranesWithOpenLogs.has(selectedCrane);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Crane Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Track crane operations and status</p>
        </div>
        {canCreateLogs && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />New Log
          </Button>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLog ? 'Edit Crane Log' : 'Create Crane Log'}</DialogTitle>
            <DialogDescription>
              {editingLog ? 'Update the log details.' : 'Start a new crane operation log.'}
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
              <Label>Crane</Label>
              <Select value={selectedCrane} onValueChange={setSelectedCrane} disabled={!!editingLog}>
                <SelectTrigger><SelectValue placeholder="Select crane" /></SelectTrigger>
                <SelectContent>
                  {cranes.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={!editingLog && cranesWithOpenLogs.has(c.id)}>
                      {c.name} {!editingLog && cranesWithOpenLogs.has(c.id) ? '(has open log)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editingLog && selectedCraneHasOpenLog && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  This crane already has an open log. Close it first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CraneStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {status === 'Working' && (
              <div className="space-y-2">
                <Label>Subcontractor</Label>
                <Select value={selectedSubcontractor} onValueChange={setSelectedSubcontractor}>
                  <SelectTrigger><SelectValue placeholder="Select subcontractor" /></SelectTrigger>
                  <SelectContent>
                    {subcontractors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Job Details</Label>
              <Textarea value={jobDetails} onChange={(e) => setJobDetails(e.target.value)} placeholder="Describe the operation..." rows={3} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="button" disabled={submitting || (!editingLog && selectedCraneHasOpenLog)} onClick={handleCreateLog}>
                {submitting ? 'Saving...' : editingLog ? 'Update Log' : 'Start Log'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="open" className="w-full">
        <TabsList>
          <TabsTrigger value="open">
            Open Logs
            {openLogs.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
                {openLogs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : openLogs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground">No open logs</h3>
                <p className="text-sm text-muted-foreground mt-1">All cranes are currently idle.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {openLogs.map((log) => (
                <Card key={log.id} className="border-l-4 border-l-emerald-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">
                            {(log.crane as any)?.name || 'Unknown Crane'}
                          </h3>
                          <Badge className={statusColors[log.status]}>{log.status}</Badge>
                          <Badge variant="approved">Open</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{log.job_details}</p>
                        {log.subcontractor && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            📋 {(log.subcontractor as any)?.company_name}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Started: {formatDateTime(log.start_time)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {(canCreateLogs || canEditClosedLogs) && (
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(log)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                          </Button>
                        )}
                        {canCloseLogs && (
                          <Button variant="secondary" size="sm" onClick={() => handleCloseLog(log.id)}>
                            <Lock className="h-3.5 w-3.5 mr-1" />Close
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : closedLogs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-foreground">No log history</h3>
                <p className="text-sm text-muted-foreground mt-1">Closed logs will appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {closedLogs.map((log) => (
                <Card key={log.id} className="border-l-4 border-l-muted">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">
                            {(log.crane as any)?.name || 'Unknown Crane'}
                          </h3>
                          <Badge className={statusColors[log.status]}>{log.status}</Badge>
                          <Badge variant="secondary">Closed</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{log.job_details}</p>
                        {log.subcontractor && (
                          <p className="text-xs text-muted-foreground mt-1">
                            📋 {(log.subcontractor as any)?.company_name}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(log.start_time)} → {log.end_time ? formatDateTime(log.end_time) : 'N/A'}
                          </span>
                        </div>
                      </div>
                      {canEditClosedLogs && (
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(log)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                        </Button>
                      )}
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
