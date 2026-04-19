import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Crane, CraneLog, CraneBooking, CraneStatus } from '@/types';
import { Clock, Construction, Activity, Calendar, AlertTriangle, Zap, RefreshCw, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── STATUS HELPERS ──────────────────────────────────────────────────────────

type StatusKey = CraneStatus | 'Idle';

const STATUS_CONFIG: Record<StatusKey, { dot: string; badge: string; label: string }> = {
  Working:               { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700',  label: 'Working' },
  Service:               { dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700',        label: 'Service' },
  'Thorough Examination':{ dot: 'bg-purple-500',  badge: 'bg-purple-50 text-purple-700',    label: 'Exam' },
  'Breaking Down':       { dot: 'bg-red-500',     badge: 'bg-red-50 text-red-600',          label: 'Breaking Down' },
  'Winded Off':          { dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700',      label: 'Winded Off' },
  Idle:                  { dot: 'bg-gray-300',    badge: 'bg-gray-100 text-gray-500',       label: 'Idle' },
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

// ─── AUTO-SCROLL CONTAINER ───────────────────────────────────────────────────

function AutoScrollContainer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);

  useEffect(() => {
    const update = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    const el = ref.current;
    if (!el) return;

    const speed = 35;
    let rafId: number;
    let lastTs: number | undefined;
    let pauseUntil = 0;

    const tick = (ts: number) => {
      if (lastTs === undefined) lastTs = ts;
      const dt = Math.min(ts - lastTs, 100);
      lastTs = ts;

      if (ts >= pauseUntil) {
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll > 10) {
          el.scrollTop += (speed * dt) / 1000;
          if (el.scrollTop >= maxScroll - 1) {
            el.scrollTop = 0;
            pauseUntil = ts + 1500;
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isDesktop]);

  return (
    <div
      ref={ref}
      className="h-full"
      style={{
        overflowY: isDesktop ? 'hidden' : 'auto',
        scrollbarWidth: 'none',
      }}
    >
      {children}
    </div>
  );
}

// ─── STAT TILE ────────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, colorClass }: {
  label: string; value: number; sub?: string; colorClass: string;
}) {
  return (
    <div className="bg-card rounded-2xl px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn('text-2xl font-bold mt-0.5', colorClass)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── SECTION CARD ─────────────────────────────────────────────────────────────

function SectionCard({ icon, title, count, countLabel, children, accent, className }: {
  icon: React.ReactNode; title: string; count?: number; countLabel?: string;
  children: React.ReactNode; accent?: boolean; className?: string;
}) {
  return (
    <div className={cn(
      'bg-card rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col h-full',
      accent && 'ring-2 ring-red-200',
      className
    )}>
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {count !== undefined && (
          <span className={cn(
            'ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full',
            accent && count > 0
              ? 'bg-red-50 text-red-600'
              : 'bg-muted text-muted-foreground'
          )}>
            {count} {countLabel}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
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
      supabase.from('crane_bookings').select('*, crane:cranes(*), subcontractor:subcontractors(*), creator:profiles(full_name)').eq('site_id', siteId).eq('status', 'pending').order('job_date_start'),
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
      return { crane, workingMs, windedMs, pct: Math.min(100, Math.round(((workingMs + windedMs) / WORK_DAY_MS) * 100)), workingPct: Math.min(100, Math.round((workingMs / WORK_DAY_MS) * 100)) };
    });
  }, [cranes, todayLogs]);

  const siteName = (profile?.site as any)?.name || 'All Sites';

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100vh-112px)] lg:overflow-hidden animate-fade-in">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Live Operations</span>
          </div>
          <h1 className="text-xl font-bold text-foreground leading-tight">{siteName}</h1>
          <p className="text-xs text-muted-foreground">
            {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground tabular-nums">
            <Clock className="h-3.5 w-3.5 text-primary" />
            {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
            Refreshed {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · auto 60s
          </button>
        </div>
      </div>

      {/* ── Summary stat tiles ──────────────────────────────────────────── */}
      <div className="shrink-0 grid grid-cols-3 gap-3">
        <StatTile label="Working" value={workingCount} sub="cranes active" colorClass="text-emerald-600" />
        <StatTile label="Idle"    value={idleCount}    sub="cranes free"   colorClass="text-gray-500" />
        <StatTile label="Pending" value={pendingCount} sub="requests"      colorClass={pendingCount > 0 ? 'text-amber-600' : 'text-gray-500'} />
      </div>

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Left column: Crane Status ── */}
        <div className="min-h-0 h-full">
          <SectionCard
            icon={<Construction className="h-3.5 w-3.5" />}
            title="Crane Status"
            count={cranes.length}
            countLabel="cranes"
          >
            {cranes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No cranes configured</p>
            ) : (
              <AutoScrollContainer>
                {cranes.map(crane => {
                  const log = craneStatusMap[crane.id];
                  const status: StatusKey = log ? log.status : 'Idle';
                  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Idle;
                  const subName = (log?.subcontractor as any)?.company_name ?? null;
                  const jobDetails = log?.job_details || null;
                  const lastUpdate = log ? (log.updated_at || log.start_time) : crane.created_at;
                  const isAvailable = !log || status === 'Idle';
                  return (
                    <div key={crane.id} className="px-3 py-2.5 border-b border-border last:border-0">
                      <div className="flex items-start gap-2">
                        <div className={cn('w-2 h-2 rounded-full shrink-0 mt-1', cfg.dot)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <p className="text-xs font-semibold text-foreground truncate">{crane.name}</p>
                            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0', cfg.badge)}>
                              {cfg.label}
                            </span>
                          </div>
                          {subName && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subName}</p>
                          )}
                          {jobDetails && (
                            <p className="text-[11px] text-foreground/70 mt-0.5 line-clamp-1">{jobDetails}</p>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-[10px] text-muted-foreground">{timeAgo(lastUpdate)}</p>
                            <span className={cn(
                              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                              isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                            )}>
                              {isAvailable ? 'Ready' : 'Busy'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </AutoScrollContainer>
            )}
          </SectionCard>
        </div>

        {/* ── Middle column ── */}
        <div className="flex flex-col gap-3 min-h-0">

          {/* Today's Activity */}
          <div className="flex-[3] min-h-0">
            <SectionCard
              icon={<Activity className="h-3.5 w-3.5" />}
              title="Today's Activity"
              count={todayLogs.length}
              countLabel="events"
            >
              {todayLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 px-3">No activity recorded today</p>
              ) : (
                <AutoScrollContainer>
                  {todayLogs.map(log => {
                    const start = new Date(log.start_time);
                    const end = log.end_time ? new Date(log.end_time) : new Date();
                    const duration = end.getTime() - start.getTime();
                    const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.Idle;
                    const craneName = (log.crane as any)?.name || '—';
                    const subName = (log.subcontractor as any)?.company_name || '—';
                    return (
                      <div key={log.id} className="px-3 py-2.5 border-b border-border last:border-0">
                        <div className="flex items-start gap-2">
                          <div className={cn('w-2 h-2 rounded-full shrink-0 mt-1', cfg.dot)} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                  {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0', cfg.badge)}>
                                  {cfg.label}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                                {formatDuration(duration)}
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold text-foreground mt-0.5">{craneName}</p>
                            <p className="text-[11px] text-muted-foreground">{subName}</p>
                            {log.job_details && (
                              <p className="text-[10px] text-foreground/60 line-clamp-1 mt-0.5">{log.job_details}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </AutoScrollContainer>
              )}
            </SectionCard>
          </div>

          {/* Utilisation Today */}
          <div className="flex-[2] min-h-0">
            <SectionCard
              icon={<Zap className="h-3.5 w-3.5" />}
              title="Utilisation Today"
            >
              <div className="px-3 py-2 space-y-3 h-full overflow-hidden">
                {utilisationData.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No cranes</p>
                )}
                {utilisationData.map(({ crane, workingMs, windedMs, pct, workingPct }) => (
                  <div key={crane.id}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-medium text-foreground">{crane.name}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatDuration(workingMs + windedMs)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden flex">
                      <div className="bg-emerald-500 transition-all duration-500 ease-out" style={{ width: `${workingPct}%` }} />
                      <div className="bg-amber-400 transition-all duration-500 ease-out" style={{ width: `${Math.max(0, pct - workingPct)}%` }} />
                    </div>
                    <div className="flex gap-2.5 mt-1">
                      <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        {formatDuration(workingMs)}
                      </span>
                      {windedMs > 0 && (
                        <span className="text-[10px] text-amber-600 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          {formatDuration(windedMs)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-3 min-h-0">

          {/* Today's Lifts */}
          <div className="flex-1 min-h-0">
            <SectionCard
              icon={<Calendar className="h-3.5 w-3.5" />}
              title="Today's Lifts"
              count={todayBookings.length}
              countLabel="scheduled"
            >
              {todayBookings.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 px-3">No lifts scheduled today</p>
              ) : (
                <AutoScrollContainer>
                  {todayBookings.map(booking => {
                    const craneName = (booking.crane as any)?.name || '—';
                    const subName = (booking.subcontractor as any)?.company_name || '—';
                    return (
                      <div key={booking.id} className="px-3 py-2.5 border-b border-border last:border-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold text-primary tabular-nums">
                            {formatTimeShort(booking.start_time)} – {formatTimeShort(booking.end_time)}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                            Approved
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-foreground mt-1">{craneName}</p>
                        <p className="text-[11px] text-muted-foreground">{subName}</p>
                        {booking.job_details && (
                          <p className="text-[11px] text-foreground/70 mt-0.5 line-clamp-2">{booking.job_details}</p>
                        )}
                      </div>
                    );
                  })}
                </AutoScrollContainer>
              )}
            </SectionCard>
          </div>

          {/* Pending Requests */}
          <div className="flex-1 min-h-0">
            <SectionCard
              icon={<AlertTriangle className={cn('h-3.5 w-3.5', pendingBookings.length > 0 ? 'text-red-500' : '')} />}
              title="Pending Requests"
              count={pendingBookings.length}
              countLabel="pending"
              accent={pendingBookings.length > 0}
            >
              {pendingBookings.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 px-3">No pending requests</p>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <AutoScrollContainer>
                      {pendingBookings.map(booking => {
                        const craneName = (booking.crane as any)?.name || '—';
                        const subName = (booking.subcontractor as any)?.company_name || null;
                        const requestedBy = (booking.creator as any)?.full_name || '—';
                        return (
                          <div key={booking.id} className="px-3 py-2.5 border-b border-border last:border-0 bg-amber-50/30">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold text-amber-700 tabular-nums">
                                {booking.job_date_start} · {formatTimeShort(booking.start_time)}–{formatTimeShort(booking.end_time)}
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold text-foreground mt-0.5">{craneName}</p>
                            {subName && <p className="text-[11px] text-muted-foreground">{subName}</p>}
                            {booking.job_details && (
                              <p className="text-[11px] text-foreground/70 mt-0.5 line-clamp-1">{booking.job_details}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-0.5">By {requestedBy}</p>
                          </div>
                        );
                      })}
                    </AutoScrollContainer>
                  </div>
                  <Link
                    to="/bookings"
                    className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-2 border-t border-border text-xs font-semibold text-primary hover:bg-muted transition-colors"
                  >
                    Review all requests
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
