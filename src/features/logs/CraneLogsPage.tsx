import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Crane, CraneLog, CraneStatus, Subcontractor } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  ClipboardList, Plus, Pencil, Lock, Clock, AlertCircle,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

const statusOptions: CraneStatus[] = [
  'Working', 'Service', 'Thorough Examination', 'Breaking Down', 'Winded Off',
];

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'pending' | 'approved' | 'cancelled';

const statusBadgeVariant: Record<CraneStatus, BadgeVariant> = {
  Working:               'approved',
  Service:               'default',
  'Thorough Examination':'secondary',
  'Breaking Down':       'destructive',
  'Winded Off':          'pending',
  Idle:                  'secondary',
};

const statusLeftBorder: Record<CraneStatus, string> = {
  Working:               'border-l-emerald-500',
  Service:               'border-l-blue-500',
  'Thorough Examination':'border-l-purple-500',
  'Breaking Down':       'border-l-red-500',
  'Winded Off':          'border-l-amber-500',
  Idle:                  'border-l-gray-300',
};

export default function CraneLogsPage() {
  const { profile } = useAuth();
  const [cranes, setCranes] = useState<Crane[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [openLogs, setOpenLogs] = useState<CraneLog[]>([]);
  const [closedLogs, setClosedLogs] = useState<CraneLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<CraneLog | null>(null);
  const [selectedCrane, setSelectedCrane] = useState('');
  const [status, setStatus] = useState<CraneStatus>('Working');
  const [jobDetails, setJobDetails] = useState('');
  const [selectedSubcontractor, setSelectedSubcontractor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cranesWithOpenLogs, setCranesWithOpenLogs] = useState<Set<string>>(new Set());

  const canCreateLogs = profile?.role === 'crane_operator' || profile?.role === 'crane_supervisor';
  const canEditClosedLogs = profile?.role === 'appointed_person';
  const canCloseLogs =
    profile?.role === 'crane_operator' ||
    profile?.role === 'crane_supervisor' ||
    profile?.role === 'appointed_person';

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
    setCranesWithOpenLogs(new Set((openLogsRes.data || []).map((l: any) => l.crane_id)));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile]);

  const handleCreateLog = async () => {
    if (!profile?.site_id || !profile?.user_id) { setError('Profile is missing site assignment'); return; }
    if (!editingLog && !selectedCrane) { setError('Please select a crane'); return; }
    if (!jobDetails.trim()) { setError('Job details are required'); return; }
    setError('');
    setSubmitting(true);

    try {
      if (editingLog) {
        const { error: updateErr } = await supabase.from('crane_logs').update({
          status,
          job_details: jobDetails,
          subcontractor_id: status === 'Working' ? selectedSubcontractor || null : null,
          updated_at: new Date().toISOString(),
        }).eq('id', editingLog.id);
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

  const LogCard = ({ log, isClosed = false }: { log: CraneLog; isClosed?: boolean }) => (
    <div className={cn(
      'bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] border-l-4 overflow-hidden',
      statusLeftBorder[log.status] || 'border-l-gray-300'
    )}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-foreground">
                {(log.crane as any)?.name || 'Unknown Crane'}
              </h3>
              <Badge variant={statusBadgeVariant[log.status]}>{log.status}</Badge>
              <Badge variant={isClosed ? 'secondary' : 'approved'}>
                {isClosed ? 'Closed' : 'Open'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{log.job_details}</p>
            {log.subcontractor && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-muted inline-flex items-center justify-center text-[10px]">S</span>
                {(log.subcontractor as any)?.company_name}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {isClosed
                  ? `${formatDateTime(log.start_time)} → ${log.end_time ? formatDateTime(log.end_time) : 'N/A'}`
                  : `Started: ${formatDateTime(log.start_time)}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(canCreateLogs || canEditClosedLogs) && (
              <Button variant="outline" size="sm" onClick={() => openEditDialog(log)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />Edit
              </Button>
            )}
            {!isClosed && canCloseLogs && (
              <Button variant="secondary" size="sm" onClick={() => handleCloseLog(log.id)}>
                <Lock className="h-3.5 w-3.5 mr-1" />Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Crane Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">Track crane operations and status</p>
        </div>
        {canCreateLogs && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-1" />New Log
          </Button>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLog ? 'Edit Crane Log' : 'Create Crane Log'}</DialogTitle>
            <DialogDescription>
              {editingLog ? 'Update the log details.' : 'Start a new crane operation log.'}
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
              <Label>Crane</Label>
              <Select value={selectedCrane} onValueChange={setSelectedCrane} disabled={!!editingLog}>
                <SelectTrigger>
                  <SelectValue placeholder="Select crane" />
                </SelectTrigger>
                <SelectContent>
                  {cranes.map((c) => (
                    <SelectItem
                      key={c.id}
                      value={c.id}
                      disabled={!editingLog && cranesWithOpenLogs.has(c.id)}
                    >
                      {c.name}{!editingLog && cranesWithOpenLogs.has(c.id) ? ' (has open log)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!editingLog && selectedCraneHasOpenLog && (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  This crane already has an open log. Close it first.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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

            <div className="space-y-1.5">
              <Label>Job Details</Label>
              <Textarea
                value={jobDetails}
                onChange={(e) => setJobDetails(e.target.value)}
                placeholder="Describe the operation..."
                rows={3}
                className="rounded-xl border-border resize-none"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button
                disabled={submitting || (!editingLog && selectedCraneHasOpenLog)}
                onClick={handleCreateLog}
              >
                {submitting ? 'Saving...' : editingLog ? 'Update Log' : 'Start Log'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <Tabs defaultValue="open" className="w-full">
        <TabsList>
          <TabsTrigger value="open">
            Open Logs
            {openLogs.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-semibold">
                {openLogs.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="space-y-3 mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : openLogs.length === 0 ? (
            <div className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-12 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <ClipboardList className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No open logs</h3>
              <p className="text-sm text-muted-foreground mt-1">All cranes are currently idle.</p>
            </div>
          ) : (
            openLogs.map((log) => <LogCard key={log.id} log={log} />)
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3 mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : closedLogs.length === 0 ? (
            <div className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-12 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <ClipboardList className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No log history</h3>
              <p className="text-sm text-muted-foreground mt-1">Closed logs will appear here.</p>
            </div>
          ) : (
            closedLogs.map((log) => <LogCard key={log.id} log={log} isClosed />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
