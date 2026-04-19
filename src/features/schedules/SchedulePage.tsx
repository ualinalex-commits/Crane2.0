import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Crane, CraneBooking, Subcontractor, BookingStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Calendar, Plus, CheckCircle2, XCircle, Clock,
  AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  format, addDays, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, parseISO, startOfDay,
} from 'date-fns';
import { cn } from '@/lib/utils';

const statusBadge: Record<BookingStatus, 'pending' | 'approved' | 'cancelled'> = {
  pending: 'pending', approved: 'approved', cancelled: 'cancelled',
};

export function SchedulePage() {
  const { profile } = useAuth();
  const [cranes, setCranes] = useState<Crane[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [bookings, setBookings] = useState<CraneBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCrane, setSelectedCrane] = useState('');
  const [jobDetails, setJobDetails] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [selectedSub, setSelectedSub] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('weekly');
  const [selectedDay, setSelectedDay] = useState(new Date());

  const isSubcontractor = profile?.role === 'subcontractor';
  const isAP = profile?.role === 'appointed_person';
  const canBook = isSubcontractor || isAP;

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const fetchData = async () => {
    if (!profile?.site_id) { setLoading(false); return; }
    const [cranesRes, subsRes, bookingsRes] = await Promise.all([
      supabase.from('cranes').select('*').eq('site_id', profile.site_id).order('name'),
      supabase.from('subcontractors').select('*').eq('site_id', profile.site_id).order('company_name'),
      supabase.from('crane_bookings').select('*, crane:cranes(*), subcontractor:subcontractors(*)').eq('site_id', profile.site_id).neq('status', 'cancelled').order('job_date_start'),
    ]);
    setCranes(cranesRes.data || []);
    setSubcontractors(subsRes.data || []);
    setBookings(bookingsRes.data as any || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile]);

  const checkOverlaps = (craneId: string, dStart: string, dEnd: string, tStart: string, tEnd: string) => {
    const conflicting = bookings.filter(b =>
      b.crane_id === craneId &&
      b.job_date_start <= dEnd && b.job_date_end >= dStart &&
      b.start_time < tEnd && b.end_time > tStart
    );
    return {
      approved: conflicting.filter(b => b.status === 'approved'),
      pending: conflicting.filter(b => b.status === 'pending'),
    };
  };

  const handleSubmit = async () => {
    if (!profile?.site_id || !profile?.user_id) { setError('Profile is missing site assignment'); return; }
    if (!selectedCrane) { setError('Please select a crane'); return; }
    if (!jobDetails.trim()) { setError('Job details are required'); return; }
    if (!dateStart) { setError('Start date is required'); return; }
    if (!startTime || !endTime) { setError('Start and end time are required'); return; }

    setError(''); setWarning(''); setSubmitting(true);

    const dEnd = dateEnd || dateStart;
    const daysDiff = Math.ceil((new Date(dEnd).getTime() - new Date(dateStart).getTime()) / 86400000) + 1;
    if (daysDiff > 7) { setError('Maximum 7 consecutive days allowed.'); setSubmitting(false); return; }

    const { approved } = checkOverlaps(selectedCrane, dateStart, dEnd, startTime, endTime);
    if (approved.length > 0) {
      setError('Time slot overlaps with an approved booking. Choose a different time.');
      setSubmitting(false);
      return;
    }

    const subId = isSubcontractor
      ? subcontractors.find(s => s.contact_email === profile.email)?.id || null
      : selectedSub || null;

    const bookingStatus = isAP ? 'approved' : 'pending';

    const { error: insertErr } = await supabase.from('crane_bookings').insert({
      crane_id: selectedCrane, site_id: profile.site_id, created_by: profile.user_id,
      job_details: jobDetails, job_date_start: dateStart, job_date_end: dEnd,
      start_time: startTime, end_time: endTime, subcontractor_id: subId,
      status: bookingStatus, approved_by: isAP ? profile.user_id : null,
    });

    if (insertErr) { setError(insertErr.message); setSubmitting(false); return; }
    setDialogOpen(false); resetForm(); setSubmitting(false); fetchData();
  };

  const handleApprove = async (id: string) => {
    if (!profile?.user_id) return;
    await supabase.from('crane_bookings').update({
      status: 'approved', approved_by: profile.user_id, updated_at: new Date().toISOString(),
    }).eq('id', id);
    fetchData();
  };

  const handleCancel = async (booking: CraneBooking) => {
    if (!profile?.user_id) return;
    await supabase.from('cancellation_log').insert({
      booking_id: booking.id, crane_id: booking.crane_id,
      cancelled_by: profile.user_id, booking_details: booking as any,
    });
    await supabase.from('crane_bookings').update({
      status: 'cancelled', updated_at: new Date().toISOString(),
    }).eq('id', booking.id);
    fetchData();
  };

  const resetForm = () => {
    setSelectedCrane(''); setJobDetails(''); setDateStart(''); setDateEnd('');
    setStartTime('08:00'); setEndTime('17:00'); setSelectedSub(''); setError(''); setWarning('');
  };

  const weekDays = eachDayOfInterval({
    start: currentWeekStart,
    end: endOfWeek(currentWeekStart, { weekStartsOn: 1 }),
  });

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const approvedBookings = bookings.filter(b => b.status === 'approved');

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">Crane booking calendar</p>
        </div>
        {canBook && (
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" />New Booking
          </Button>
        )}
      </div>

      {/* Booking Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Crane Booking</DialogTitle>
            <DialogDescription>Book a crane for your job.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            {error && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />{error}
              </div>
            )}
            {warning && (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />{warning}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Crane</Label>
              <Select value={selectedCrane} onValueChange={setSelectedCrane}>
                <SelectTrigger><SelectValue placeholder="Select crane" /></SelectTrigger>
                <SelectContent>
                  {cranes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {isAP && (
              <div className="space-y-1.5">
                <Label>Subcontractor</Label>
                <Select value={selectedSub} onValueChange={setSelectedSub}>
                  <SelectTrigger><SelectValue placeholder="Select subcontractor" /></SelectTrigger>
                  <SelectContent>
                    {subcontractors.map(s => <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Job Details</Label>
              <Textarea
                value={jobDetails}
                onChange={e => setJobDetails(e.target.value)}
                placeholder="Describe the job..."
                rows={2}
                className="rounded-xl border-border resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} min={tomorrow} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} min={dateStart || tomorrow} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Booking...' : 'Submit Booking'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Views */}
      {isAP ? (
        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="pending">
              Pending
              {pendingBookings.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold">
                  {pendingBookings.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">All Bookings</TabsTrigger>
          </TabsList>
          <TabsContent value="calendar">
            <WeeklyView weekDays={weekDays} bookings={bookings} currentWeekStart={currentWeekStart} setCurrentWeekStart={setCurrentWeekStart} cranes={cranes} showDetails />
          </TabsContent>
          <TabsContent value="pending">
            <BookingsList bookings={pendingBookings} onApprove={handleApprove} onCancel={handleCancel} showActions />
          </TabsContent>
          <TabsContent value="all">
            <BookingsList bookings={bookings} onCancel={handleCancel} showActions={false} />
          </TabsContent>
        </Tabs>
      ) : isSubcontractor ? (
        <Tabs defaultValue="calendar">
          <TabsList>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="my">My Bookings</TabsTrigger>
          </TabsList>
          <TabsContent value="calendar">
            <WeeklyView weekDays={weekDays} bookings={bookings} currentWeekStart={currentWeekStart} setCurrentWeekStart={setCurrentWeekStart} cranes={cranes} showDetails={false} />
          </TabsContent>
          <TabsContent value="my">
            <BookingsList bookings={bookings.filter(b => b.created_by === profile?.user_id)} onCancel={handleCancel} showActions canCancel />
          </TabsContent>
        </Tabs>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Button
              variant={viewMode === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('weekly')}
            >Weekly</Button>
            <Button
              variant={viewMode === 'daily' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('daily')}
            >Daily</Button>
          </div>
          {viewMode === 'weekly' ? (
            <WeeklyView weekDays={weekDays} bookings={approvedBookings} currentWeekStart={currentWeekStart} setCurrentWeekStart={setCurrentWeekStart} cranes={cranes} showDetails />
          ) : (
            <DailyView day={selectedDay} setDay={setSelectedDay} bookings={approvedBookings} cranes={cranes} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── WEEKLY VIEW ─────────────────────────────────────────────────────────────
function WeeklyView({ weekDays, bookings, currentWeekStart, setCurrentWeekStart, cranes, showDetails }: any) {
  return (
    <div className="space-y-4 mt-2">
      {/* Week nav */}
      <div className="flex items-center justify-between bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground">
          {format(currentWeekStart, 'dd MMM')} – {format(addDays(currentWeekStart, 6), 'dd MMM yyyy')}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {weekDays.map((day: Date) => {
          const dayBookings = bookings.filter((b: CraneBooking) => {
            const s = parseISO(b.job_date_start);
            const e = parseISO(b.job_date_end);
            return day >= startOfDay(s) && day <= startOfDay(e);
          });
          const isToday = isSameDay(day, new Date());
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'rounded-2xl p-3 min-h-[110px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-colors',
                isToday
                  ? 'bg-primary/8 ring-2 ring-primary/30'
                  : 'bg-card'
              )}
            >
              <p className={cn(
                'text-xs font-bold mb-2',
                isToday ? 'text-primary' : 'text-muted-foreground'
              )}>
                {format(day, 'EEE dd')}
              </p>
              <div className="space-y-1">
                {dayBookings.map((b: CraneBooking) => (
                  <div
                    key={b.id}
                    className={cn(
                      'text-xs px-2 py-1.5 rounded-xl',
                      b.status === 'approved'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    )}
                  >
                    <p className="font-semibold truncate">{(b.crane as any)?.name}</p>
                    <p className="opacity-75 text-[10px] tabular-nums">
                      {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
                    </p>
                    {showDetails && (
                      <p className="truncate opacity-60 text-[10px]">{(b.subcontractor as any)?.company_name}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DAILY VIEW ──────────────────────────────────────────────────────────────
function DailyView({ day, setDay, bookings, cranes }: any) {
  const dayBookings = bookings.filter((b: CraneBooking) => {
    const s = parseISO(b.job_date_start);
    const e = parseISO(b.job_date_end);
    return day >= startOfDay(s) && day <= startOfDay(e);
  });

  return (
    <div className="space-y-4 mt-2">
      <div className="flex items-center justify-between bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => setDay(addDays(day, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-foreground">
          {format(day, 'EEEE, dd MMMM yyyy')}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setDay(addDays(day, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {dayBookings.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-10 text-center">
          <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No bookings for this day</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayBookings.map((b: CraneBooking) => (
            <div key={b.id} className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-4 flex items-center gap-4">
              <div className="w-1.5 h-12 rounded-full bg-emerald-500 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">{(b.crane as any)?.name}</p>
                <p className="text-sm text-muted-foreground tabular-nums">
                  {b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{b.job_details}</p>
              </div>
              <Badge variant="approved">Approved</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BOOKINGS LIST ────────────────────────────────────────────────────────────
function BookingsList({ bookings, onApprove, onCancel, showActions, canCancel }: any) {
  if (bookings.length === 0) {
    return (
      <div className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-10 text-center mt-2">
        <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No bookings found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-2">
      {bookings.map((b: CraneBooking) => (
        <div
          key={b.id}
          className="bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] p-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] transition-shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-foreground">{(b.crane as any)?.name}</span>
                <Badge variant={statusBadge[b.status as BookingStatus]}>{b.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{b.job_details}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {b.job_date_start}{b.job_date_end !== b.job_date_start ? ` → ${b.job_date_end}` : ''}
                </span>
                <span className="tabular-nums">{b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}</span>
                {(b.subcontractor as any)?.company_name && (
                  <span>{(b.subcontractor as any).company_name}</span>
                )}
              </div>
            </div>
            {showActions && (
              <div className="flex gap-2 shrink-0">
                {onApprove && b.status === 'pending' && (
                  <Button size="sm" variant="success" onClick={() => onApprove(b.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                  </Button>
                )}
                {(canCancel || onApprove) && b.status !== 'cancelled' && (
                  <Button size="sm" variant="destructive" onClick={() => onCancel(b)}>
                    <XCircle className="h-3.5 w-3.5 mr-1" />Cancel
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
