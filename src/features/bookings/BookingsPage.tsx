import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { CraneBooking } from '@/types';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, Building2, User, FileText, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function BookingsPage() {
  const { profile } = useAuth();
  const [pendingBookings, setPendingBookings] = useState<CraneBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    if (!profile?.site_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('crane_bookings')
      .select('*, crane:cranes(*), subcontractor:subcontractors(*), creator:profiles(full_name, role)')
      .eq('site_id', profile.site_id)
      .eq('status', 'pending')
      .order('job_date_start')
      .order('start_time');
    if (error) console.error('[BookingsPage] fetch error:', error);
    setPendingBookings((data as any) || []);
    setLoading(false);
  }, [profile?.site_id]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (b: CraneBooking) => {
    if (!profile?.user_id) return;
    setActionId(b.id);
    await supabase.from('crane_bookings').update({
      status: 'approved',
      approved_by: profile.user_id,
      updated_at: new Date().toISOString(),
    }).eq('id', b.id);
    setActionId(null);
    fetchPending();
  };

  const handleCancel = async (b: CraneBooking) => {
    if (!profile?.user_id) return;
    setActionId(b.id);
    await supabase.from('cancellation_log').insert({
      booking_id: b.id,
      crane_id: b.crane_id,
      cancelled_by: profile.user_id,
      booking_details: b as any,
    });
    await supabase.from('crane_bookings').update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    }).eq('id', b.id);
    setActionId(null);
    fetchPending();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Booking Requests</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pendingBookings.length === 0
              ? 'No pending requests'
              : `${pendingBookings.length} request${pendingBookings.length !== 1 ? 's' : ''} awaiting review`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchPending} className="h-8 w-8 p-0">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {pendingBookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">All caught up</p>
          <p className="text-xs text-muted-foreground/70 mt-1">No pending booking requests right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingBookings.map(b => {
            const crane = b.crane as any;
            const sub = b.subcontractor as any;
            const creator = b.creator as any;
            const durationMins = toMins(b.end_time) - toMins(b.start_time);
            const durationStr = durationMins >= 60
              ? `${Math.floor(durationMins / 60)}h${durationMins % 60 > 0 ? ` ${durationMins % 60}m` : ''}`
              : `${durationMins}m`;
            const busy = actionId === b.id;

            return (
              <div
                key={b.id}
                className="bg-card rounded-2xl border border-amber-200 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden"
              >
                <div className="h-1 bg-amber-400" />
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{crane?.name || 'Crane'}</p>
                      {crane?.model && (
                        <p className="text-xs text-muted-foreground">{crane.model}</p>
                      )}
                    </div>
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
                      Pending
                    </span>
                  </div>

                  {/* Date & time */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-foreground">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-semibold">
                      {b.job_date_start === b.job_date_end
                        ? format(parseISO(b.job_date_start), 'd MMMM yyyy')
                        : `${format(parseISO(b.job_date_start), 'd MMM')} – ${format(parseISO(b.job_date_end), 'd MMM yyyy')}`}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span>{b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}</span>
                    <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                      {durationStr}
                    </span>
                  </div>

                  {/* Subcontractor */}
                  {sub && (
                    <div className="flex items-center gap-2 text-xs text-foreground">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{sub.company_name}</span>
                      {sub.contact_name && (
                        <span className="text-muted-foreground">· {sub.contact_name}</span>
                      )}
                    </div>
                  )}

                  {/* Requested by */}
                  {creator && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Requested by{' '}
                        <span className="font-medium text-foreground">{creator.full_name}</span>
                        {creator.role && (
                          <span className="capitalize"> · {String(creator.role).replace(/_/g, ' ')}</span>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Job details */}
                  {b.job_details && (
                    <div className="flex items-start gap-2 text-xs text-foreground">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="leading-relaxed text-foreground/80">{b.job_details}</p>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    Submitted {format(parseISO(b.created_at), 'd MMM yyyy, HH:mm')}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="success"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => handleApprove(b)}
                    >
                      <CheckCircle2 className={cn('h-4 w-4 mr-1.5', busy && 'animate-spin')} />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      disabled={busy}
                      onClick={() => handleCancel(b)}
                    >
                      <XCircle className="h-4 w-4 mr-1.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
