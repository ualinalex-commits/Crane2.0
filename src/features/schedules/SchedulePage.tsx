import React, { useEffect, useState, useMemo, useRef, useLayoutEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveProfile } from '@/contexts/TestModeContext';
import type { Crane, CraneBooking, Subcontractor, BookingStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Plus, CheckCircle2, XCircle, Clock,
  AlertCircle, ChevronLeft, ChevronRight, User, Building2, X, FileText,
  Construction,
} from 'lucide-react';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

// ── Layout constants ──────────────────────────────────────────────────────────
const HOUR_START = 6;
const HOUR_END = 22;
const SLOT_H = 60;                               // px per 30-min slot
const TOTAL_SLOTS = (HOUR_END - HOUR_START) * 2; // 32 half-hour slots
const TOTAL_H = TOTAL_SLOTS * SLOT_H;            // 1920px total height
const TIME_W = 64;                               // px – fixed left column
const COL_W = 200;                               // px – each crane column

// ── Helpers ───────────────────────────────────────────────────────────────────
function toMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function fromMins(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function bookingTop(startTime: string): number {
  return ((toMins(startTime) - HOUR_START * 60) / 30) * SLOT_H;
}

function bookingHeight(startTime: string, endTime: string): number {
  return ((toMins(endTime) - toMins(startTime)) / 30) * SLOT_H;
}

function currentTimeTop(): number {
  const now = new Date();
  return ((now.getHours() * 60 + now.getMinutes() - HOUR_START * 60) / 30) * SLOT_H;
}

const SLOT_LABELS = Array.from({ length: TOTAL_SLOTS }, (_, i) =>
  fromMins(HOUR_START * 60 + i * 30)
);

const STATUS_COLOR: Record<BookingStatus, { bg: string; border: string; text: string; left: string; dot: string }> = {
  approved:  { bg: '#f0fdf4', border: '#86efac', text: '#14532d', left: '#22c55e', dot: '#22c55e' },
  pending:   { bg: '#fffbeb', border: '#fcd34d', text: '#78350f', left: '#f59e0b', dot: '#f59e0b' },
  cancelled: { bg: '#fef2f2', border: '#fca5a5', text: '#7f1d1d', left: '#ef4444', dot: '#ef4444' },
};

// ── Horizontal timeline constants (Bookings tab) ──────────────────────────────
const GRID_ROW_H   = 64;
const GRID_SLOT_W  = 40;                         // px per 30-min slot (horizontal)
const CRANE_COL_W  = 128;                        // px – fixed crane name column
const GRID_HEADER_H = 36;                        // px – time label row
const GRID_TOTAL_W = TOTAL_SLOTS * GRID_SLOT_W;  // 1280px

const HOUR_MARKS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => ({
  hour:  HOUR_START + i,
  left:  i * 2 * GRID_SLOT_W,
  label: `${String(HOUR_START + i).padStart(2, '0')}:00`,
}));

function blockLeft(startTime: string): number {
  return ((toMins(startTime) - HOUR_START * 60) / 30) * GRID_SLOT_W;
}

function blockWidth(startTime: string, endTime: string): number {
  return Math.max(GRID_SLOT_W / 2, ((toMins(endTime) - toMins(startTime)) / 30) * GRID_SLOT_W);
}

function currentTimeLeft(): number {
  const now = new Date();
  return ((now.getHours() * 60 + now.getMinutes() - HOUR_START * 60) / 30) * GRID_SLOT_W;
}

function layoutHorizCrane(bks: CraneBooking[]): { b: CraneBooking; row: number; rows: number }[] {
  const sorted = [...bks].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const result: { b: CraneBooking; row: number; rows: number }[] = [];
  const subRows: CraneBooking[][] = [];

  for (const b of sorted) {
    let placed = false;
    for (let r = 0; r < subRows.length; r++) {
      if (!subRows[r].some(o => b.start_time < o.end_time && b.end_time > o.start_time)) {
        subRows[r].push(b);
        result.push({ b, row: r, rows: 0 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      subRows.push([b]);
      result.push({ b, row: subRows.length - 1, rows: 0 });
    }
  }

  for (const item of result) {
    const overlapping = result.filter(
      o => item.b.start_time < o.b.end_time && item.b.end_time > o.b.start_time
    );
    item.rows = overlapping.length > 0 ? Math.max(...overlapping.map(o => o.row)) + 1 : 1;
  }

  return result;
}

// ── Overlap layout ────────────────────────────────────────────────────────────
type LayoutItem = { b: CraneBooking; col: number; cols: number };

function layoutBookings(bks: CraneBooking[]): LayoutItem[] {
  const sorted = [...bks].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const items: LayoutItem[] = [];
  const columns: CraneBooking[][] = [];

  for (const b of sorted) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (!columns[c].some(o => b.start_time < o.end_time && b.end_time > o.start_time)) {
        columns[c].push(b);
        items.push({ b, col: c, cols: 0 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([b]);
      items.push({ b, col: columns.length - 1, cols: 0 });
    }
  }

  for (const item of items) {
    const overlapping = items.filter(
      o => item.b.start_time < o.b.end_time && item.b.end_time > o.b.start_time
    );
    item.cols = Math.max(...overlapping.map(o => o.col)) + 1;
  }

  return items;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SchedulePage() {
  const { profile: authProfile } = useAuth();
  const profile = useEffectiveProfile();
  const [cranes, setCranes] = useState<Crane[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [bookings, setBookings] = useState<CraneBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'approved' | 'pending' | 'bookings'>('approved');

  // New booking form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formCrane, setFormCrane] = useState('');
  const [formJob, setFormJob] = useState('');
  const [formDateStart, setFormDateStart] = useState('');
  const [formDateEnd, setFormDateEnd] = useState('');
  const [formTimeStart, setFormTimeStart] = useState('08:00');
  const [formTimeEnd, setFormTimeEnd] = useState('17:00');
  const [formSub, setFormSub] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Detail overlay
  const [overlayBooking, setOverlayBooking] = useState<CraneBooking | null>(null);

  // Current time line
  const [timeTop,  setTimeTop]  = useState(currentTimeTop());
  const [timeLeft, setTimeLeft] = useState(currentTimeLeft());

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollH, setScrollH] = useState(500);

  const isAP = profile?.role === 'appointed_person';
  const isSub = profile?.role === 'subcontractor';
  const canBook = isAP || isSub;
  const isToday = isSameDay(selectedDate, new Date());
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  // ── Data ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    if (!profile?.site_id) { setLoading(false); return; }
    const [cranesRes, subsRes, bookingsRes] = await Promise.all([
      supabase.from('cranes').select('*').eq('site_id', profile.site_id).order('name'),
      supabase.from('subcontractors').select('*').eq('site_id', profile.site_id).order('company_name'),
      supabase
        .from('crane_bookings')
        .select('*, crane:cranes(*), subcontractor:subcontractors(*)')
        .eq('site_id', profile.site_id)
        .order('job_date_start'),
    ]);
    console.log('bookings fetched:', bookingsRes.data, '| error:', bookingsRes.error);
    setCranes(cranesRes.data || []);
    setSubcontractors(subsRes.data || []);
    setBookings((bookingsRes.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const update = () => {
      if (!scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const bottomNav = window.innerWidth < 1024 ? 72 : 0;
      setScrollH(Math.max(300, window.innerHeight - rect.top - bottomNav));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [loading]);

  useEffect(() => {
    const id = setInterval(() => {
      setTimeTop(currentTimeTop());
      setTimeLeft(currentTimeLeft());
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!scrollRef.current || !isToday) return;
    const t = setTimeout(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTop = Math.max(0, currentTimeTop() - 120);
    }, 150);
    return () => clearTimeout(t);
  }, [loading, isToday]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const approvedDayBookings = useMemo(() => {
    const dayStr = format(selectedDate, 'yyyy-MM-dd');
    return bookings.filter(b =>
      b.status === 'approved' &&
      b.job_date_start <= dayStr && b.job_date_end >= dayStr
    );
  }, [bookings, selectedDate]);

  const pendingBookings = useMemo(() =>
    bookings.filter(b => b.status === 'pending'),
    [bookings]
  );

  const allDayBookings = useMemo(() => {
    const dayStr = format(selectedDate, 'yyyy-MM-dd');
    return bookings.filter(b =>
      b.status !== 'cancelled' &&
      b.job_date_start <= dayStr && b.job_date_end >= dayStr
    );
  }, [bookings, selectedDate]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const checkOverlaps = (craneId: string, dStart: string, dEnd: string, tS: string, tE: string) => {
    const hits = bookings.filter(b =>
      b.crane_id === craneId &&
      b.job_date_start <= dEnd && b.job_date_end >= dStart &&
      b.start_time < tE && b.end_time > tS
    );
    return { approved: hits.filter(b => b.status === 'approved') };
  };

  const handleSubmit = async () => {
    if (!profile?.site_id || !profile?.user_id) { setFormError('Profile is missing site assignment'); return; }
    if (!formCrane) { setFormError('Please select a crane'); return; }
    if (!formJob.trim()) { setFormError('Job details are required'); return; }
    if (!formDateStart || !formTimeStart || !formTimeEnd) { setFormError('Date and times are required'); return; }

    setFormError(''); setSubmitting(true);
    const dEnd = formDateEnd || formDateStart;
    const days = Math.ceil((new Date(dEnd).getTime() - new Date(formDateStart).getTime()) / 86_400_000) + 1;
    if (days > 7) { setFormError('Maximum 7 consecutive days allowed.'); setSubmitting(false); return; }

    const { approved } = checkOverlaps(formCrane, formDateStart, dEnd, formTimeStart, formTimeEnd);
    if (approved.length > 0) {
      setFormError('Time slot overlaps with an approved booking. Choose a different time.');
      setSubmitting(false);
      return;
    }

    const subId = isSub
      ? subcontractors.find(s => s.contact_email === profile.email)?.id ?? null
      : formSub || null;

    const { error: err } = await supabase.from('crane_bookings').insert({
      crane_id: formCrane, site_id: profile.site_id, created_by: profile.user_id,
      job_details: formJob, job_date_start: formDateStart, job_date_end: dEnd,
      start_time: formTimeStart, end_time: formTimeEnd, subcontractor_id: subId,
      status: isAP ? 'approved' : 'pending',
      approved_by: isAP ? authProfile?.user_id ?? profile.user_id : null,
    });

    if (err) { setFormError(err.message); setSubmitting(false); return; }
    setDialogOpen(false);
    resetForm();
    setSubmitting(false);
    fetchData();
  };

  const handleApprove = async (id: string) => {
    if (!profile?.user_id) return;
    await supabase.from('crane_bookings').update({
      status: 'approved', approved_by: profile.user_id, updated_at: new Date().toISOString(),
    }).eq('id', id);
    setOverlayBooking(null);
    fetchData();
  };

  const handleCancel = async (b: CraneBooking) => {
    if (!profile?.user_id) return;
    await supabase.from('cancellation_log').insert({
      booking_id: b.id, crane_id: b.crane_id,
      cancelled_by: profile.user_id, booking_details: b as any,
    });
    await supabase.from('crane_bookings').update({
      status: 'cancelled', updated_at: new Date().toISOString(),
    }).eq('id', b.id);
    setOverlayBooking(null);
    fetchData();
  };

  const resetForm = () => {
    setFormCrane(''); setFormJob(''); setFormDateStart(''); setFormDateEnd('');
    setFormTimeStart('08:00'); setFormTimeEnd('17:00'); setFormSub(''); setFormError('');
  };

  const openNewBooking = (craneId?: string, slotTime?: string) => {
    resetForm();
    setFormDateStart(format(selectedDate, 'yyyy-MM-dd'));
    if (craneId) setFormCrane(craneId);
    if (slotTime) {
      setFormTimeStart(slotTime);
      const endMins = Math.min(toMins(slotTime) + 60, HOUR_END * 60);
      setFormTimeEnd(fromMins(endMins));
    }
    setDialogOpen(true);
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const gridMinW = TIME_W + cranes.length * COL_W;

  return (
    <div className="flex flex-col -mx-4 -mt-4 -mb-24 lg:-mx-6 lg:-mt-6 lg:-mb-6 animate-fade-in">

      {/* ── Tab toggle ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background">
        <div className="flex rounded-lg overflow-hidden border border-border">
          <button
            onClick={() => setActiveTab('approved')}
            className={cn(
              'px-4 py-1.5 text-sm font-semibold transition-colors',
              activeTab === 'approved'
                ? 'bg-orange-500 text-white'
                : 'bg-background text-muted-foreground hover:text-foreground'
            )}
          >
            Approved
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={cn(
              'px-4 py-1.5 text-sm font-semibold transition-colors flex items-center gap-1.5 border-l border-border',
              activeTab === 'pending'
                ? 'bg-orange-500 text-white'
                : 'bg-background text-muted-foreground hover:text-foreground'
            )}
          >
            Pending
            {pendingBookings.length > 0 && (
              <span className={cn(
                'inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold',
                activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'
              )}>
                {pendingBookings.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={cn(
              'px-4 py-1.5 text-sm font-semibold transition-colors border-l border-border',
              activeTab === 'bookings'
                ? 'bg-orange-500 text-white'
                : 'bg-background text-muted-foreground hover:text-foreground'
            )}
          >
            Bookings
          </button>
        </div>

        {canBook && (
          <Button
            size="sm"
            className="h-7 text-xs px-3 ml-auto shrink-0"
            onClick={() => openNewBooking()}
          >
            <Plus className="h-3 w-3 mr-1" />New
          </Button>
        )}
      </div>

      {/* ── Approved tab: Google Calendar timeline ───────────────────────────── */}
      {activeTab === 'approved' && (
        <>
          {/* Date navigation */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-background">
            <Button
              variant="ghost" size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={() => setSelectedDate(d => addDays(d, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex-1 text-center min-w-0">
              <p className={cn('text-sm font-semibold truncate', isToday && 'text-primary')}>
                {format(selectedDate, 'EEEE, d MMMM yyyy')}
              </p>
            </div>

            <Button
              variant="ghost" size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={() => setSelectedDate(d => addDays(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {!isToday && (
              <Button
                variant="outline" size="sm"
                className="h-7 text-xs px-2.5 shrink-0"
                onClick={() => setSelectedDate(new Date())}
              >
                Today
              </Button>
            )}
          </div>

          {/* Calendar scroll container */}
          <div ref={scrollRef} className="overflow-auto" style={{ height: scrollH }}>
            <div style={{ minWidth: gridMinW }}>

              {/* Crane header row */}
              <div
                className="sticky top-0 z-20 flex bg-card border-b border-border shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                style={{ minWidth: gridMinW }}
              >
                <div className="shrink-0 border-r border-border bg-card" style={{ width: TIME_W }} />
                {cranes.map(crane => {
                  const craneBks = approvedDayBookings.filter(b => b.crane_id === crane.id);
                  const dotColor = craneBks.length > 0 ? '#22c55e' : '#d1d5db';
                  return (
                    <div
                      key={crane.id}
                      className="shrink-0 border-r border-border px-2.5 py-2"
                      style={{ width: COL_W }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                        <span className="text-xs font-semibold text-foreground truncate leading-tight">
                          {crane.name}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5 pl-3.5">
                        {crane.model || crane.capacity || ''}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Timeline body */}
              <div className="relative flex" style={{ height: TOTAL_H }}>

                {/* Time column */}
                <div
                  className="sticky left-0 z-10 shrink-0 bg-background border-r border-border"
                  style={{ width: TIME_W }}
                >
                  {SLOT_LABELS.map((label, i) => (
                    <div
                      key={label}
                      className="absolute inset-x-0 flex items-start justify-end pr-2"
                      style={{ top: i * SLOT_H, height: SLOT_H }}
                    >
                      {i % 2 === 0 && (
                        <span className="text-[10px] text-muted-foreground tabular-nums leading-none select-none -mt-1.5">
                          {label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* One column per crane */}
                {cranes.map(crane => {
                  const craneBks = approvedDayBookings.filter(b => b.crane_id === crane.id);
                  const laid = layoutBookings(craneBks);

                  return (
                    <div
                      key={crane.id}
                      className="relative shrink-0 border-r border-border bg-card"
                      style={{ width: COL_W }}
                    >
                      {/* Grid lines + click zones */}
                      {SLOT_LABELS.map((label, i) => (
                        <div
                          key={label}
                          className={cn(
                            'absolute inset-x-0 border-b',
                            canBook && 'cursor-pointer hover:bg-primary/[0.04] transition-colors',
                            i % 2 === 0 ? 'border-border/40' : 'border-border/15',
                          )}
                          style={{ top: i * SLOT_H, height: SLOT_H }}
                          onClick={() => canBook && openNewBooking(crane.id, label)}
                        />
                      ))}

                      {/* Booking blocks */}
                      {laid.map(({ b, col, cols }) => {
                        const top = bookingTop(b.start_time);
                        const height = Math.max(22, bookingHeight(b.start_time, b.end_time));
                        const c = STATUS_COLOR[b.status as BookingStatus] ?? STATUS_COLOR.pending;
                        const bw = (COL_W - 2) / cols;
                        const compact = height < 38;

                        return (
                          <div
                            key={b.id}
                            className="absolute rounded-lg overflow-hidden cursor-pointer z-10 hover:shadow-md hover:z-20 transition-all duration-150"
                            style={{
                              top: top + 2,
                              height: height - 4,
                              left: col * bw + 2,
                              width: bw - 4,
                              backgroundColor: c.bg,
                              border: `1px solid ${c.border}`,
                            }}
                            onClick={e => { e.stopPropagation(); setOverlayBooking(b); }}
                          >
                            <div
                              className="absolute inset-y-0 left-0 w-1 rounded-l-lg"
                              style={{ backgroundColor: c.left }}
                            />
                            <div className="h-full flex flex-col pl-2.5 pr-1 py-1 overflow-hidden gap-0.5">
                              <div className="flex items-center gap-1 min-w-0">
                                <span
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: c.dot }}
                                />
                                <span
                                  className="text-[10px] font-semibold truncate leading-tight"
                                  style={{ color: c.text }}
                                >
                                  {(b.subcontractor as any)?.company_name
                                    || (b.creator as any)?.full_name
                                    || '—'}
                                </span>
                              </div>
                              {!compact && (
                                <span
                                  className="text-[9px] tabular-nums leading-none pl-2.5"
                                  style={{ color: c.text, opacity: 0.7 }}
                                >
                                  {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                                </span>
                              )}
                              {height >= 56 && (
                                <span
                                  className="text-[9px] leading-tight pl-2.5 line-clamp-2"
                                  style={{ color: c.text, opacity: 0.55 }}
                                >
                                  {b.job_details}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Current time indicator */}
                {isToday && timeTop >= 0 && timeTop <= TOTAL_H && (
                  <div
                    className="absolute z-30 pointer-events-none flex items-center"
                    style={{ top: timeTop, left: TIME_W, right: 0 }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 -ml-1.5 shadow-sm shadow-red-500/40" />
                    <div className="flex-1 border-t-2 border-red-500" />
                  </div>
                )}

                {cranes.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 py-20 text-center px-6">
                    <Construction className="h-12 w-12 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">No cranes on this site</p>
                    <p className="text-xs text-muted-foreground/70">Ask your appointed person to add cranes.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Pending tab: booking request list ───────────────────────────────── */}
      {activeTab === 'pending' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {pendingBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No pending requests</p>
              <p className="text-xs text-muted-foreground/70">All bookings are up to date.</p>
            </div>
          ) : (
            pendingBookings.map(b => (
              <PendingCard
                key={b.id}
                booking={b}
                isAP={isAP}
                onApprove={() => handleApprove(b.id)}
                onCancel={() => handleCancel(b)}
              />
            ))
          )}
        </div>
      )}

      {/* ── Bookings tab: restaurant-style horizontal timeline ───────────────── */}
      {activeTab === 'bookings' && (
        <>
          {/* Date navigation */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-background">
            <Button
              variant="ghost" size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={() => setSelectedDate(d => addDays(d, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex-1 text-center min-w-0">
              <p className={cn('text-sm font-semibold truncate', isToday && 'text-primary')}>
                {format(selectedDate, 'EEEE, d MMMM yyyy')}
              </p>
            </div>

            <Button
              variant="ghost" size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={() => setSelectedDate(d => addDays(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            {!isToday && (
              <Button
                variant="outline" size="sm"
                className="h-7 text-xs px-2.5 shrink-0"
                onClick={() => setSelectedDate(new Date())}
              >
                Today
              </Button>
            )}
          </div>

          {/* Horizontal timeline grid */}
          <div className="overflow-auto" style={{ height: scrollH }}>
            <div style={{ minWidth: CRANE_COL_W + GRID_TOTAL_W }}>

              {/* ── Sticky time-header row ───────────────────────────────────── */}
              <div
                className="sticky top-0 z-20 flex bg-white border-b border-[#E5E7EB]"
                style={{ height: GRID_HEADER_H, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
              >
                {/* Corner cell – sticky left AND top */}
                <div
                  className="sticky left-0 z-30 shrink-0 flex items-center px-3 border-r border-[#E5E7EB] bg-white"
                  style={{ width: CRANE_COL_W }}
                >
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Crane
                  </span>
                </div>

                {/* Hour labels strip */}
                <div className="relative overflow-hidden" style={{ width: GRID_TOTAL_W }}>
                  {HOUR_MARKS.map(({ hour, left, label }) => (
                    <div
                      key={hour}
                      className="absolute top-0 bottom-0 flex items-end pb-1.5"
                      style={{ left }}
                    >
                      <span className="text-[10px] text-muted-foreground tabular-nums select-none pl-1">
                        {label}
                      </span>
                    </div>
                  ))}
                  {/* Vertical lines inside header */}
                  {HOUR_MARKS.slice(1).map(({ hour, left }) => (
                    <div
                      key={`hdr-vline-${hour}`}
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{ left, borderLeft: '1px solid #E5E7EB' }}
                    />
                  ))}
                </div>
              </div>

              {/* ── Crane rows ───────────────────────────────────────────────── */}
              {cranes.map((crane, craneIdx) => {
                const craneBks = allDayBookings.filter(b => b.crane_id === crane.id);
                const laid = layoutHorizCrane(craneBks);
                const maxSubRows = laid.length > 0 ? Math.max(...laid.map(i => i.rows)) : 1;
                const rowH = Math.max(GRID_ROW_H, maxSubRows * 44 + 12);
                const isEven = craneIdx % 2 === 0;

                return (
                  <div
                    key={crane.id}
                    className="flex border-b border-[#E5E7EB]"
                    style={{ height: rowH }}
                  >
                    {/* Crane name cell – sticky left */}
                    <div
                      className="sticky left-0 z-10 shrink-0 flex items-center px-3 border-r border-[#E5E7EB]"
                      style={{ width: CRANE_COL_W, backgroundColor: 'white' }}
                    >
                      <div className="min-w-0 w-full">
                        <p className="text-xs font-semibold text-foreground leading-tight truncate">
                          {crane.name}
                        </p>
                        {crane.model && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {crane.model}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Booking area */}
                    <div
                      className="relative"
                      style={{
                        width: GRID_TOTAL_W,
                        backgroundColor: isEven ? 'white' : '#FAFAF8',
                      }}
                    >
                      {/* Hour vertical grid lines */}
                      {HOUR_MARKS.slice(1).map(({ hour, left }) => (
                        <div
                          key={`vl-${hour}`}
                          className="absolute top-0 bottom-0 pointer-events-none"
                          style={{ left, borderLeft: '0.5px solid #E5E7EB' }}
                        />
                      ))}

                      {/* Half-hour lines (lighter) */}
                      {HOUR_MARKS.slice(0, -1).map(({ hour, left }) => (
                        <div
                          key={`hl-${hour}`}
                          className="absolute top-0 bottom-0 pointer-events-none"
                          style={{ left: left + GRID_SLOT_W, borderLeft: '0.5px solid #F3F4F6' }}
                        />
                      ))}

                      {/* Current time vertical line – orange */}
                      {isToday && timeLeft >= 0 && timeLeft <= GRID_TOTAL_W && (
                        <div
                          className="absolute top-0 bottom-0 pointer-events-none z-10"
                          style={{ left: timeLeft, borderLeft: '2px solid #F97316' }}
                        />
                      )}

                      {/* Booking blocks */}
                      {laid.map(({ b, row, rows: totalRows }) => {
                        const bLeft   = blockLeft(b.start_time);
                        const bWidth  = blockWidth(b.start_time, b.end_time);
                        const bH      = (rowH - 12) / totalRows;
                        const bTop    = row * bH + 6;
                        const bHeight = bH - 4;
                        const isPending = b.status === 'pending';
                        const textCol   = isPending ? '#92400E' : '#065F46';

                        return (
                          <div
                            key={b.id}
                            className="absolute cursor-pointer transition-shadow duration-150"
                            style={{
                              left:            bLeft + 2,
                              width:           Math.max(20, bWidth - 4),
                              top:             bTop,
                              height:          bHeight,
                              backgroundColor: isPending ? '#FEF3C7' : '#D1FAE5',
                              border:          isPending ? '1.5px dashed #FCD34D' : '1.5px solid #6EE7B7',
                              borderRadius:    8,
                              boxShadow:       '0 1px 3px rgba(0,0,0,0.08)',
                              opacity:         isPending ? 0.88 : 1,
                              zIndex:          5,
                            }}
                            onClick={e => { e.stopPropagation(); setOverlayBooking(b); }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                              (e.currentTarget as HTMLElement).style.zIndex = '20';
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
                              (e.currentTarget as HTMLElement).style.zIndex = '5';
                            }}
                          >
                            <div className="h-full px-1.5 py-1 flex flex-col overflow-hidden gap-0.5 pr-4">
                              {/* Pending label */}
                              {isPending && (
                                <span
                                  className="text-[8px] font-bold uppercase tracking-wide leading-none"
                                  style={{ color: '#92400E' }}
                                >
                                  Pending
                                </span>
                              )}
                              {/* Subcontractor / creator name */}
                              <span
                                className="text-[10px] font-semibold truncate leading-tight"
                                style={{ color: textCol }}
                              >
                                {(b.subcontractor as any)?.company_name
                                  || (b.creator as any)?.full_name
                                  || '—'}
                              </span>
                              {/* Job details (only when block is wide enough) */}
                              {bWidth > 80 && (
                                <span
                                  className="text-[9px] truncate leading-tight"
                                  style={{ color: textCol, opacity: 0.7 }}
                                >
                                  {b.job_details}
                                </span>
                              )}
                              {/* Time range */}
                              {bWidth > 55 && (
                                <span
                                  className="text-[9px] tabular-nums leading-none"
                                  style={{ color: textCol, opacity: 0.6 }}
                                >
                                  {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                                </span>
                              )}
                            </div>

                            {/* Pending clock icon */}
                            {isPending && (
                              <div className="absolute top-1 right-1">
                                <Clock className="h-2.5 w-2.5" style={{ color: '#92400E', opacity: 0.7 }} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Empty state */}
              {cranes.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center px-6">
                  <Construction className="h-12 w-12 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">No cranes on this site</p>
                  <p className="text-xs text-muted-foreground/70">Ask your appointed person to add cranes.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── New Booking Dialog ───────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Crane Booking</DialogTitle>
            <DialogDescription>Book a crane for your job.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-1">
            {formError && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Crane</Label>
              <Select value={formCrane} onValueChange={setFormCrane}>
                <SelectTrigger><SelectValue placeholder="Select crane" /></SelectTrigger>
                <SelectContent>
                  {cranes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isAP && (
              <div className="space-y-1.5">
                <Label>Subcontractor <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Select value={formSub} onValueChange={setFormSub}>
                  <SelectTrigger><SelectValue placeholder="Select subcontractor" /></SelectTrigger>
                  <SelectContent>
                    {subcontractors.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Job / Lift Details</Label>
              <Textarea
                value={formJob}
                onChange={e => setFormJob(e.target.value)}
                placeholder="Describe the job or lift…"
                rows={2}
                className="rounded-xl resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formDateStart}
                  onChange={e => setFormDateStart(e.target.value)}
                  min={tomorrow}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  type="date"
                  value={formDateEnd}
                  onChange={e => setFormDateEnd(e.target.value)}
                  min={formDateStart || tomorrow}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={formTimeStart} onChange={e => setFormTimeStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={formTimeEnd} onChange={e => setFormTimeEnd(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Booking…' : 'Submit Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Booking Detail Overlay ───────────────────────────────────────────── */}
      {overlayBooking && (
        <BookingOverlay
          booking={overlayBooking}
          isAP={isAP}
          isSub={isSub}
          userId={profile?.user_id}
          onClose={() => setOverlayBooking(null)}
          onApprove={() => handleApprove(overlayBooking.id)}
          onCancel={() => handleCancel(overlayBooking)}
        />
      )}
    </div>
  );
}

// ── Pending booking card ──────────────────────────────────────────────────────
function PendingCard({
  booking: b, isAP, onApprove, onCancel,
}: {
  booking: CraneBooking;
  isAP: boolean;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const crane   = b.crane        as any;
  const sub     = b.subcontractor as any;
  const creator = b.creator       as any;

  const dateLabel = b.job_date_start === b.job_date_end
    ? format(parseISO(b.job_date_start), 'd MMMM yyyy')
    : `${format(parseISO(b.job_date_start), 'd MMM')} – ${format(parseISO(b.job_date_end), 'd MMM yyyy')}`;

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm p-4 space-y-3">
      {/* Top row: crane name + amber badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Construction className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="font-bold text-foreground">{crane?.name || 'Crane'}</span>
          {crane?.model && (
            <span className="text-xs text-muted-foreground">{crane.model}</span>
          )}
        </div>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
          Pending
        </span>
      </div>

      {/* Details grid */}
      <div className="space-y-1.5 text-sm">
        <div className="flex items-start gap-2 text-muted-foreground">
          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            {dateLabel} &middot; {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
          </span>
        </div>

        {sub && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{sub.company_name}{sub.contact_name ? ` · ${sub.contact_name}` : ''}</span>
          </div>
        )}

        {creator && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <User className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{creator.full_name}</span>
          </div>
        )}

        {b.job_details && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="leading-relaxed">{b.job_details}</span>
          </div>
        )}
      </div>

      {/* Action buttons (AP only) */}
      {isAP && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            onClick={onApprove}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={onCancel}
          >
            <XCircle className="h-4 w-4 mr-1.5" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Booking Detail Overlay ────────────────────────────────────────────────────
function BookingOverlay({
  booking: b, isAP, isSub, userId, onClose, onApprove, onCancel,
}: {
  booking: CraneBooking;
  isAP: boolean;
  isSub: boolean;
  userId?: string;
  onClose: () => void;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const crane   = b.crane        as any;
  const sub     = b.subcontractor as any;
  const creator = b.creator       as any;
  const status  = b.status        as BookingStatus;
  const c       = STATUS_COLOR[status] ?? STATUS_COLOR.pending;

  const durationMins = toMins(b.end_time) - toMins(b.start_time);
  const durationStr  = durationMins >= 60
    ? `${Math.floor(durationMins / 60)}h${durationMins % 60 > 0 ? ` ${durationMins % 60}m` : ''}`
    : `${durationMins}m`;

  const isOwnPending = isSub && b.created_by === userId && b.status === 'pending';
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed z-50 bg-card',
          'inset-x-0 bottom-0 rounded-t-3xl max-h-[88dvh] overflow-y-auto animate-slide-up',
          'lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2',
          'lg:w-full lg:max-w-md lg:rounded-2xl lg:shadow-2xl lg:max-h-[85dvh] lg:overflow-y-auto',
          'lg:[animation:fadeIn_0.2s_ease-out]',
        )}
      >
        <div className="lg:hidden flex justify-center pt-3 pb-0.5">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-border">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-foreground text-base">{crane?.name || 'Crane'}</span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: c.dot }} />
                {statusLabel}
              </span>
            </div>
            {crane?.model && (
              <p className="text-xs text-muted-foreground mt-0.5">{crane.model} · {crane.capacity}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-2 shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <section className="space-y-3">
            <DetailRow icon={<Clock className="h-4 w-4" />} label="Date">
              {b.job_date_start === b.job_date_end
                ? format(parseISO(b.job_date_start), 'd MMMM yyyy')
                : `${format(parseISO(b.job_date_start), 'd MMM')} – ${format(parseISO(b.job_date_end), 'd MMM yyyy')}`
              }
            </DetailRow>
            <DetailRow icon={<Clock className="h-4 w-4" />} label="Time">
              <span>{b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}</span>
              <span className="ml-2 inline-block text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground font-medium">
                {durationStr}
              </span>
            </DetailRow>
          </section>

          <div className="border-t border-border" />

          <section className="space-y-3">
            {sub && (
              <DetailRow icon={<Building2 className="h-4 w-4" />} label="Subcontractor">
                <p className="text-sm font-medium text-foreground">{sub.company_name}</p>
                {sub.contact_name && (
                  <p className="text-xs text-muted-foreground">{sub.contact_name}</p>
                )}
              </DetailRow>
            )}
            {creator && (
              <DetailRow icon={<User className="h-4 w-4" />} label="Requested by">
                <p className="text-sm font-medium text-foreground">{creator.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {String(creator.role ?? '').replace(/_/g, ' ')}
                </p>
              </DetailRow>
            )}
          </section>

          <div className="border-t border-border" />

          <DetailRow icon={<FileText className="h-4 w-4" />} label="Job / Lift">
            <p className="text-sm text-foreground leading-relaxed">{b.job_details || '—'}</p>
          </DetailRow>

          <div className="border-t border-border" />

          <DetailRow icon={<Clock className="h-4 w-4" />} label="Booking created">
            <p className="text-sm text-muted-foreground">
              {format(parseISO(b.created_at), 'd MMM yyyy, HH:mm')}
            </p>
          </DetailRow>
        </div>

        <div className="px-5 pb-8 pt-1 flex gap-2 flex-wrap border-t border-border">
          {isAP && b.status === 'pending' && (
            <Button size="sm" variant="success" className="flex-1 min-w-[100px]" onClick={onApprove}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />Approve
            </Button>
          )}
          {isAP && b.status !== 'cancelled' && (
            <Button size="sm" variant="destructive" className="flex-1 min-w-[100px]" onClick={onCancel}>
              <XCircle className="h-4 w-4 mr-1.5" />Cancel
            </Button>
          )}
          {isOwnPending && (
            <Button size="sm" variant="destructive" className="flex-1 min-w-[100px]" onClick={onCancel}>
              <XCircle className="h-4 w-4 mr-1.5" />Cancel Booking
            </Button>
          )}
          <Button size="sm" variant="outline" className="flex-1 min-w-[80px]" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </>
  );
}

// ── Detail row helper ─────────────────────────────────────────────────────────
function DetailRow({
  icon, label, children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
          {label}
        </p>
        <div>{children}</div>
      </div>
    </div>
  );
}
