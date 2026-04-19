import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Crane, CraneLog, CraneBooking, Subcontractor, CraneStatus } from '@/types';
import { Clock, Construction, Activity, Calendar, AlertTriangle, Zap, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── STATUS HELPERS ──────────────────────────────────────────────────────────

type StatusKey = CraneStatus | 'Idle';

const STATUS_CONFIG: Record<StatusKey, { dot: string; badge: string; label: string }> = {
  Working:              { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700',  label: 'Working' },
  Service:              { dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700',        label: 'Service' },
  'Thorough Examination':{ dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700',    label: 'Exam' },
  'Breaking Down':      { dot: 'bg-red-500',     badge: 'bg-red-50 text-red-600',          label: 'Breaking Down' },
  'Winded Off':         { dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700',      label: 'Winded Off' },
  Idle:                 { dot: 'bg-gray-300',    badge: 'bg-gray-100 text-gray-500',       label: 'Idle' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(ms: number): string {
  const hrs = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatTimeShort(time: string): string {
  return time.slice(0, 5);
}

// ─── STAT TILE ────────────────────────────────────────────────────────────────
function StatTile({ label, value, sub, colorClass }: {
  label: string; value: number; sub?: string; colorClass: string;
}) {
  return (
    <div className="bg-card rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('text-3xl font-bold mt-1', colorClass)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── SECTION CARD ─────────────────────────────────────────────────────────────
function SectionCard({ icon, title, count, countLabel, children, accent }: {
  icon: React.ReactNode; title: string; count?: number; countLabel?: string;
  children: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={cn(
      'bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden',
      accent && 'ring-2 ring-red-200'
    )}>
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {count !== undefined && (
          <span className={cn(
            'ml-auto text-xs font-semibold px-2 py-0.5 rounded-full',
            accent && count > 0
              ? 'bg-red-50 text-red-600'
              : 'bg-muted text-muted-foreground'
          )}>
            {count} {countLabel}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function LiveDashboard() {
  const { profile } = useAuth();
  const [cranes, setCranes] = useState<Crane[]>([]);
  const [openLogs, setOpenLogs] = useState<CraneLog[]>([]);
  const [todayLogs, setTodayLogs] = useState<CraneLog[]>([]);
  const [todayBookings, setTodayBookings] = useState<CraneBooking[]>([]);
  const [pendingBookings, setPendingBookings] = useState<CraneBooking[]>([]);
  const [now, setNow] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const fetchAll = useCallback(async () => {
    if (!profile?.site_id) return;
    const siteId = profile.site_id;

    const [cranesRes, openLogsRes, todayLogsRes, todayBookingsRes, pendingRes] = await Promise.all([
      supabase.from('cranes').select('*').eq('site_id', siteId).order('name'),
      supabase.from('crane_logs').select('*, crane:cranes(*), subcontractor:subcontractors(*)').eq('site_id', siteId).eq('is_open', true),
      supabase.from('crane_logs').select('*, crane:cranes(*), subcontractor:subcontractors(*)').eq('site_id', siteId).gte('start_time', today + 'T00:00:00').order('start_time', { ascending: false }),
      supabase.from('crane_bookings').select('*, crane:cranes(*), subcontractor:subcontractors(*)').eq('site_id', siteId).eq('status', 'approved').lte('job_date_start', today).gte('job_date_end', today).order('start_time'),
      supabase.from('crane_bookings').select('*, crane:cranes(*), subcontractor:subcontractors(*)').eq('site_id', siteId).eq('status', 'pending').order('job_date_start'),
    ]);

    setCranes(cranesRes.data || []);
    setOpenLogs(openLogsRes.data as any || []);
    setTodayLogs(todayLogsRes.data as any || []);
    setTodayBookings(todayBookingsRes.data as any || []);
    setPendingBookings(pendingRes.data as any || []);
    setLastRefresh(new Date());
  }, [profile?.site_id, today]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  // ─── DERIVED STATE ──────────────────────────────────────────────────────
  const craneStatusMap = useMemo(() => {
    const map: Record<string, CraneLog> = {};
    openLogs.forEach(log => { map[log.crane_id] = log; });
    return map;
  }, [openLogs]);

  const workingCount = openLogs.filter(l => l.status === 'Working').length;
  const idleCount = cranes.length - openLogs.length;
  const pendingCount = pendingBookings.length;

  const utilisationData = useMemo(() => {
    const WORK_DAY_MS = 10 * 3600000;
    return cranes.map(crane => {
      const logs = todayLogs.filter(l => l.crane_id === crane.id);
      let workingMs = 0;
      let windedMs = 0;
      logs.forEach(log => {
        const start = new Date(log.start_time).getTime();
        const end = log.end_time ? new Date(log.end_time).getTime() : Date.now();
        const duration = end - start;
        if (log.status === 'Working') workingMs += duration;
        else if (log.status === 'Winded Off') windedMs += duration;
      });
      return {
        crane,
        workingMs,
        windedMs,
        totalMs: workingMs + windedMs,
        pct: Math.min(100, Math.round(((workingMs + windedMs) / WORK_DAY_MS) * 100)),
        workingPct: Math.min(100, Math.round((workingMs / WORK_DAY_MS) * 100)),
      };
    });
  }, [cranes, todayLogs]);

  const siteName = (profile?.site as any)?.name || 'All Sites';

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Live Operations</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{siteName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground tabular-nums">
            <Clock className="h-4 w-4 text-primary" />
            {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </button>
        </div>
      </div>

      {/* ── Summary stat tiles ──────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Working" value={workingCount} sub="cranes active" colorClass="text-emerald-600" />
        <StatTile label="Idle" value={idleCount} sub="cranes free" colorClass="text-gray-500" />
        <StatTile label="Pending" value={pendingCount} sub="requests" colorClass={pendingCount > 0 ? 'text-amber-600' : 'text-gray-500'} />
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* ── Left column ─── */}
        <div className="space-y-4">

          {/* Crane Status */}
          <SectionCard
            icon={<Construction className="h-4 w-4" />}
            title="Crane Status"
            count={cranes.length}
            countLabel="cranes"
          >
            <div className="space-y-2">
              {cranes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No cranes configured</p>
              )}
              {cranes.map(crane => {
                const log = craneStatusMap[crane.id];
                const status: StatusKey = log ? log.status : 'Idle';
                const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Idle;
                const subName = log?.subcontractor ? (log.subcontractor as any).company_name : null;
                const lastUpdate = log ? log.updated_at || log.start_time : crane.created_at;
                return (
                  <div key={crane.id} className="flex items-center gap-3 p-3 rounded-xl bg-background">
                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', cfg.dot)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{crane.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {subName || (status !== 'Idle' && status !== 'Working' ? status : 'Available')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', cfg.badge)}>
                        {cfg.label}
                      </span>
                      <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(lastUpdate)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Availability */}
          <SectionCard
            icon={<Activity className="h-4 w-4" />}
            title="Availability"
          >
            <div className="divide-y divide-border">
              {cranes.map(crane => {
                const hasOpenLog = !!craneStatusMap[crane.id];
                const busy = hasOpenLog && craneStatusMap[crane.id].status !== 'Idle';
                return (
                  <div key={crane.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <span className="text-sm font-medium text-foreground">{crane.name}</span>
                    <span className={cn(
                      'text-xs font-semibold px-2.5 py-1 rounded-full',
                      busy ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                    )}>
                      {busy ? 'Busy' : 'Ready'}
                    </span>
                  </div>
                );
              })}
              {cranes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-3">No cranes</p>
              )}
            </div>
          </SectionCard>
        </div>

        {/* ── Middle column ─── */}
        <div className="space-y-4">

          {/* Today's Activity */}
          <SectionCard
            icon={<Activity className="h-4 w-4" />}
            title="Today's Activity"
            count={todayLogs.length}
            countLabel="events"
          >
            <div className="space-y-0 -mx-4 max-h-72 overflow-y-auto">
              {todayLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 px-4">No activity recorded today</p>
              ) : (
                todayLogs.map(log => {
                  const start = new Date(log.start_time);
                  const end = log.end_time ? new Date(log.end_time) : new Date();
                  const duration = end.getTime() - start.getTime();
                  const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.Idle;
                  return (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 hover:bg-background transition-colors">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                      <span className="text-xs text-muted-foreground w-10 shrink-0 tabular-nums">
                        {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={cn('text-xs font-semibold', cfg.badge.split(' ')[1])}>{log.status}</span>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {(log.crane as any)?.name} · {(log.subcontractor as any)?.company_name || '—'}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatDuration(duration)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          {/* Utilisation Today */}
          <SectionCard
            icon={<Zap className="h-4 w-4" />}
            title="Utilisation Today"
          >
            <div className="space-y-4">
              {utilisationData.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">No cranes</p>
              )}
              {utilisationData.map(({ crane, workingMs, windedMs, pct, workingPct }) => (
                <div key={crane.id}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium text-foreground">{crane.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDuration(workingMs + windedMs)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                    <div
                      className="bg-emerald-500 transition-all duration-500 ease-out"
                      style={{ width: `${workingPct}%` }}
                    />
                    <div
                      className="bg-amber-400 transition-all duration-500 ease-out"
                      style={{ width: `${Math.max(0, pct - workingPct)}%` }}
                    />
                  </div>
                  <div className="flex gap-3 mt-1.5">
                    <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Working {formatDuration(workingMs)}
                    </span>
                    {windedMs > 0 && (
                      <span className="text-[10px] text-amber-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        Winded {formatDuration(windedMs)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Right column ─── */}
        <div className="space-y-4">

          {/* Today's Lifts */}
          <SectionCard
            icon={<Calendar className="h-4 w-4" />}
            title="Today's Lifts"
            count={todayBookings.length}
            countLabel="scheduled"
          >
            <div className="space-y-0 -mx-4 max-h-60 overflow-y-auto">
              {todayBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 px-4">No lifts scheduled today</p>
              ) : (
                todayBookings.map(booking => {
                  const craneName = (booking.crane as any)?.name || '—';
                  const subName = (booking.subcontractor as any)?.company_name || '—';
                  return (
                    <div key={booking.id} className="px-4 py-3 border-b border-border last:border-0 hover:bg-background transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-primary tabular-nums">
                          {formatTimeShort(booking.start_time)} – {formatTimeShort(booking.end_time)}
                        </span>
                        <span className="text-xs text-muted-foreground">{craneName}</span>
                      </div>
                      <p className="text-xs text-foreground font-medium mt-1 line-clamp-1">{booking.job_details}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{subName}</p>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>

          {/* Pending Requests */}
          <SectionCard
            icon={<AlertTriangle className={cn('h-4 w-4', pendingBookings.length > 0 ? 'text-red-500' : '')} />}
            title="Pending Requests"
            count={pendingBookings.length}
            countLabel="pending"
            accent={pendingBookings.length > 0}
          >
            <div className="space-y-0 -mx-4 max-h-64 overflow-y-auto">
              {pendingBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6 px-4">No pending requests</p>
              ) : (
                pendingBookings.map(booking => {
                  const craneName = (booking.crane as any)?.name || '—';
                  const subName = (booking.subcontractor as any)?.company_name || '—';
                  return (
                    <div key={booking.id} className="px-4 py-3 border-b border-border last:border-0 bg-red-50/40 hover:bg-red-50 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-red-600 tabular-nums">
                          {new Date(booking.job_date_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          {' '}{formatTimeShort(booking.start_time)} – {formatTimeShort(booking.end_time)}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                          Pending
                        </span>
                      </div>
                      <p className="text-xs text-foreground font-medium mt-1 line-clamp-1">{booking.job_details}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{subName} · {craneName}</p>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        Auto-refreshes every 60s · Last updated {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
    </div>
  );
}
