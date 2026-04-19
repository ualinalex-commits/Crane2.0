import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Crane, CraneLog, CraneBooking, Subcontractor, CraneStatus } from '@/types';
import { Clock, Construction, ChevronDown, Activity, Calendar, AlertTriangle, Zap } from 'lucide-react';

// ─── THEME COLORS ────────────────────────────────────────────────────────────
const BG = '#0b1929';
const CARD_BG = '#112240';
const CARD_BORDER = '#1e3a5f';
const HEADER_BG = '#0d2137';
const TEXT_PRIMARY = '#e2e8f0';
const TEXT_SECONDARY = '#8892b0';
const TEXT_MUTED = '#5a6a8a';
const GOLD = '#f0c040';
const GREEN = '#10b981';
const AMBER = '#f59e0b';
const RED = '#ef4444';
const GREY = '#475569';
const BLUE_ACCENT = '#3b82f6';

// ─── STATUS HELPERS ──────────────────────────────────────────────────────────
function getStatusDot(status: CraneStatus | 'Idle') {
  const colors: Record<string, string> = {
    'Working': GREEN,
    'Service': AMBER,
    'Thorough Examination': '#a855f7',
    'Breaking Down': RED,
    'Winded Off': AMBER,
    'Idle': GREY,
  };
  return colors[status] || GREY;
}

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

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function LiveDashboard() {
  const { profile } = useAuth();
  const [cranes, setCranes] = useState<Crane[]>([]);
  const [openLogs, setOpenLogs] = useState<CraneLog[]>([]);
  const [todayLogs, setTodayLogs] = useState<CraneLog[]>([]);
  const [todayBookings, setTodayBookings] = useState<CraneBooking[]>([]);
  const [pendingBookings, setPendingBookings] = useState<CraneBooking[]>([]);
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [now, setNow] = useState(new Date());
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  // ─── DATA FETCH ──────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!profile?.site_id) return;
    const siteId = profile.site_id;

    const [cranesRes, openLogsRes, todayLogsRes, todayBookingsRes, pendingRes, subsRes] = await Promise.all([
      supabase.from('cranes').select('*').eq('site_id', siteId).order('name'),
      supabase.from('crane_logs').select('*, crane:cranes(*), subcontractor:subcontractors(*)').eq('site_id', siteId).eq('is_open', true),
      supabase.from('crane_logs').select('*, crane:cranes(*), subcontractor:subcontractors(*)').eq('site_id', siteId).gte('start_time', today + 'T00:00:00').order('start_time', { ascending: false }),
      supabase.from('crane_bookings').select('*, crane:cranes(*), subcontractor:subcontractors(*)').eq('site_id', siteId).eq('status', 'approved').lte('job_date_start', today).gte('job_date_end', today).order('start_time'),
      supabase.from('crane_bookings').select('*, crane:cranes(*), subcontractor:subcontractors(*)').eq('site_id', siteId).eq('status', 'pending').order('job_date_start'),
      supabase.from('subcontractors').select('*').eq('site_id', siteId),
    ]);

    setCranes(cranesRes.data || []);
    setOpenLogs(openLogsRes.data as any || []);
    setTodayLogs(todayLogsRes.data as any || []);
    setTodayBookings(todayBookingsRes.data as any || []);
    setPendingBookings(pendingRes.data as any || []);
    setSubcontractors(subsRes.data || []);
    setLastRefresh(new Date());
  }, [profile?.site_id, today]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(fetchAll, 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Live clock
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  // ─── DERIVED STATE ───────────────────────────────────────────────────────
  const craneStatusMap = useMemo(() => {
    const map: Record<string, CraneLog> = {};
    openLogs.forEach(log => { map[log.crane_id] = log; });
    return map;
  }, [openLogs]);

  const workingCount = openLogs.filter(l => l.status === 'Working').length;
  const idleCount = cranes.length - openLogs.length;
  const pendingCount = pendingBookings.length;

  // Utilisation: calculate working time per crane today
  const utilisationData = useMemo(() => {
    const WORK_DAY_MS = 10 * 3600000; // 10h working day
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

  // ─── STYLES ──────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    background: CARD_BG,
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 14,
    overflow: 'hidden',
  };
  const cardHeaderStyle: React.CSSProperties = {
    padding: '14px 18px',
    borderBottom: `1px solid ${CARD_BORDER}`,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 600,
    color: TEXT_SECONDARY,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  };
  const cardBodyStyle: React.CSSProperties = {
    padding: '12px 18px',
  };

  const siteName = (profile?.site as any)?.name || 'All Sites';

  return (
    <div style={{ background: BG, minHeight: 'calc(100% + 2rem)', color: TEXT_PRIMARY, fontFamily: "'Inter', system-ui, sans-serif", margin: '-1rem -1rem -1rem -1rem', padding: 0 }}>
      {/* ─── HEADER BAR ──────────────────────────────────────────────────── */}
      <div style={{
        background: HEADER_BG,
        borderBottom: `1px solid ${CARD_BORDER}`,
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' }}>
          <Zap style={{ color: GOLD, width: 20, height: 20 }} />
          <span style={{ color: GOLD, fontWeight: 700, fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' }}>
            Lifting Ops
          </span>
          <span style={{ color: TEXT_MUTED, fontSize: 13, fontWeight: 400 }}>— Live Dashboard</span>
        </div>

        {/* Site filter */}
        <div style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 8,
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          color: TEXT_SECONDARY,
          cursor: 'default',
        }}>
          {siteName}
          <ChevronDown style={{ width: 14, height: 14, opacity: 0.5 }} />
        </div>

        {/* Status badges */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatusBadge label="Working" count={workingCount} color={GREEN} />
          <StatusBadge label="Idle" count={idleCount} color={GREY} />
          <StatusBadge label="Pending" count={pendingCount} color={AMBER} />
        </div>

        {/* Live clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 500, color: TEXT_SECONDARY, fontVariantNumeric: 'tabular-nums' }}>
          <Clock style={{ width: 14, height: 14, color: BLUE_ACCENT }} />
          {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>

      {/* ─── MAIN GRID ───────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, alignItems: 'start' }}>

        {/* ═══ LEFT COLUMN ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Crane Status */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <Construction style={{ width: 16, height: 16, color: GOLD }} />
              Crane Status
              <span style={{ marginLeft: 'auto', fontSize: 11, color: TEXT_MUTED, fontWeight: 400, textTransform: 'none' }}>
                {cranes.length} cranes
              </span>
            </div>
            <div style={{ ...cardBodyStyle, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cranes.map(crane => {
                const log = craneStatusMap[crane.id];
                const status: CraneStatus | 'Idle' = log ? log.status : 'Idle';
                const subName = log?.subcontractor ? (log.subcontractor as any).company_name : '—';
                const lastUpdate = log ? log.updated_at || log.start_time : crane.created_at;
                return (
                  <div key={crane.id} style={{
                    background: '#0d2137',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    border: `1px solid ${log ? CARD_BORDER : 'transparent'}`,
                  }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: getStatusDot(status),
                      boxShadow: `0 0 8px ${getStatusDot(status)}60`,
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{crane.name}</div>
                      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                        {status !== 'Idle' && status !== 'Working' ? status : subName}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: getStatusDot(status),
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                      }}>
                        {status}
                      </div>
                      <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>
                        {timeAgo(lastUpdate)}
                      </div>
                    </div>
                  </div>
                );
              })}
              {cranes.length === 0 && (
                <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: 20, fontSize: 13 }}>
                  No cranes configured
                </div>
              )}
            </div>
          </div>

          {/* Availability */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <Activity style={{ width: 16, height: 16, color: GREEN }} />
              Availability
            </div>
            <div style={{ ...cardBodyStyle, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cranes.map(crane => {
                const hasOpenLog = !!craneStatusMap[crane.id];
                const busy = hasOpenLog && craneStatusMap[crane.id].status !== 'Idle';
                return (
                  <div key={crane.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: `1px solid ${CARD_BORDER}20`,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{crane.name}</span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: 20,
                      background: busy ? `${RED}20` : `${GREEN}20`,
                      color: busy ? RED : GREEN,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}>
                      {busy ? 'Busy' : 'Ready'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══ MIDDLE COLUMN ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Today's Activity */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <Activity style={{ width: 16, height: 16, color: BLUE_ACCENT }} />
              Today's Activity
              <span style={{ marginLeft: 'auto', fontSize: 11, color: TEXT_MUTED, fontWeight: 400, textTransform: 'none' }}>
                {todayLogs.length} events
              </span>
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {todayLogs.length === 0 ? (
                <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: '30px 20px', fontSize: 13 }}>
                  No activity recorded today
                </div>
              ) : (
                todayLogs.map(log => {
                  const start = new Date(log.start_time);
                  const end = log.end_time ? new Date(log.end_time) : new Date();
                  const duration = end.getTime() - start.getTime();
                  const craneName = (log.crane as any)?.name || '—';
                  const subName = (log.subcontractor as any)?.company_name || '—';
                  return (
                    <div key={log.id} style={{
                      padding: '10px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      borderBottom: `1px solid ${CARD_BORDER}40`,
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: getStatusDot(log.status),
                        boxShadow: `0 0 6px ${getStatusDot(log.status)}50`,
                        flexShrink: 0,
                      }} />
                      <div style={{ fontSize: 12, color: TEXT_MUTED, width: 44, flexShrink: 0 }}>
                        {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: getStatusDot(log.status) }}>
                          {log.status}
                        </div>
                        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 1 }}>
                          {craneName} • {subName}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: TEXT_MUTED, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {formatDuration(duration)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Utilisation Today */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <Zap style={{ width: 16, height: 16, color: AMBER }} />
              Utilisation Today
            </div>
            <div style={{ ...cardBodyStyle, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {utilisationData.map(({ crane, workingMs, windedMs, pct, workingPct }) => (
                <div key={crane.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{crane.name}</span>
                    <span style={{ fontSize: 12, color: TEXT_MUTED }}>
                      {formatDuration(workingMs + windedMs)}
                    </span>
                  </div>
                  <div style={{
                    height: 8,
                    borderRadius: 4,
                    background: '#0d2137',
                    overflow: 'hidden',
                    display: 'flex',
                  }}>
                    <div style={{
                      width: `${workingPct}%`,
                      background: GREEN,
                      borderRadius: '4px 0 0 4px',
                      transition: 'width 0.3s ease',
                    }} />
                    <div style={{
                      width: `${Math.max(0, pct - workingPct)}%`,
                      background: AMBER,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: GREEN, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN, display: 'inline-block' }} />
                      Working {formatDuration(workingMs)}
                    </span>
                    {windedMs > 0 && (
                      <span style={{ fontSize: 10, color: AMBER, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: AMBER, display: 'inline-block' }} />
                        Winded {formatDuration(windedMs)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {cranes.length === 0 && (
                <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: 16, fontSize: 13 }}>No cranes</div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Today's Lifts */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <Calendar style={{ width: 16, height: 16, color: BLUE_ACCENT }} />
              Today's Lifts
              <span style={{ marginLeft: 'auto', fontSize: 11, color: TEXT_MUTED, fontWeight: 400, textTransform: 'none' }}>
                {todayBookings.length} scheduled
              </span>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {todayBookings.length === 0 ? (
                <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: '30px 20px', fontSize: 13 }}>
                  No lifts scheduled today
                </div>
              ) : (
                todayBookings.map(booking => {
                  const craneName = (booking.crane as any)?.name || '—';
                  const subName = (booking.subcontractor as any)?.company_name || '—';
                  return (
                    <div key={booking.id} style={{
                      padding: '10px 18px',
                      borderBottom: `1px solid ${CARD_BORDER}40`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: BLUE_ACCENT, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {formatTimeShort(booking.start_time)} – {formatTimeShort(booking.end_time)}
                        </span>
                        <span style={{ fontSize: 11, color: TEXT_MUTED }}>{craneName}</span>
                      </div>
                      <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>
                        {booking.job_details}
                      </div>
                      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                        {subName}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pending Requests */}
          <div style={{
            ...cardStyle,
            border: pendingBookings.length > 0 ? `1px solid ${RED}40` : `1px solid ${CARD_BORDER}`,
          }}>
            <div style={{
              ...cardHeaderStyle,
              borderBottomColor: pendingBookings.length > 0 ? `${RED}30` : CARD_BORDER,
            }}>
              <AlertTriangle style={{ width: 16, height: 16, color: pendingBookings.length > 0 ? RED : TEXT_MUTED }} />
              Pending Requests
              {pendingBookings.length > 0 && (
                <span style={{
                  marginLeft: 8,
                  background: `${RED}20`,
                  color: RED,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 10,
                }}>
                  {pendingBookings.length}
                </span>
              )}
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {pendingBookings.length === 0 ? (
                <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: '30px 20px', fontSize: 13 }}>
                  No pending requests
                </div>
              ) : (
                pendingBookings.map(booking => {
                  const craneName = (booking.crane as any)?.name || '—';
                  const subName = (booking.subcontractor as any)?.company_name || '—';
                  return (
                    <div key={booking.id} style={{
                      padding: '10px 18px',
                      borderBottom: `1px solid ${RED}15`,
                      background: `${RED}05`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: RED, fontWeight: 600 }}>
                          {new Date(booking.job_date_start).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          {' '}{formatTimeShort(booking.start_time)} – {formatTimeShort(booking.end_time)}
                        </span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: `${AMBER}20`,
                          color: AMBER,
                          textTransform: 'uppercase',
                        }}>
                          Pending
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: TEXT_SECONDARY, marginTop: 4 }}>
                        {booking.job_details}
                      </div>
                      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
                        {subName} • {craneName}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── FOOTER ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 24px',
        fontSize: 10,
        color: TEXT_MUTED,
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Auto-refreshes every 60s</span>
        <span>Last updated: {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
    </div>
  );
}

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────────
function StatusBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: `${color}15`,
      border: `1px solid ${color}30`,
      borderRadius: 20,
      padding: '4px 12px',
      fontSize: 12,
      fontWeight: 600,
      color,
    }}>
      <div style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 6px ${color}60`,
      }} />
      {count} {label}
    </div>
  );
}
