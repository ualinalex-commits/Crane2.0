import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Building2, MapPin, Construction, ClipboardList, Calendar, Users, LogOut,
  ChevronDown, Shield, UserCircle, LayoutDashboard, Bell, ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: UserRole[];
  exact?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <LayoutDashboard className="h-5 w-5" />,
    roles: ['appointed_person'],
    exact: true,
  },
  {
    label: 'Companies',
    href: '/companies',
    icon: <Building2 className="h-5 w-5" />,
    roles: ['admin'],
  },
  {
    label: 'Sites',
    href: '/sites',
    icon: <MapPin className="h-5 w-5" />,
    roles: ['admin', 'company_admin'],
  },
  {
    label: 'Cranes',
    href: '/cranes',
    icon: <Construction className="h-5 w-5" />,
    roles: ['appointed_person'],
  },
  {
    label: 'Site Users',
    href: '/site-users',
    icon: <Users className="h-5 w-5" />,
    roles: ['appointed_person'],
  },
  {
    label: 'Logs',
    href: '/logs',
    icon: <ClipboardList className="h-5 w-5" />,
    roles: ['appointed_person', 'crane_supervisor', 'crane_operator'],
  },
  {
    label: 'Schedule',
    href: '/schedule',
    icon: <Calendar className="h-5 w-5" />,
    roles: ['appointed_person', 'crane_supervisor', 'crane_operator', 'slinger_signaller', 'subcontractor'],
  },
  {
    label: 'Bookings',
    href: '/bookings',
    icon: <ClipboardCheck className="h-5 w-5" />,
    roles: ['appointed_person'],
  },
];

function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Admin',
    company_admin: 'Company Admin',
    appointed_person: 'Appointed Person',
    crane_supervisor: 'Crane Supervisor',
    crane_operator: 'Crane Operator',
    slinger_signaller: 'Slinger Signaller',
    subcontractor: 'Subcontractor',
  };
  return labels[role] || role;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!profile?.site_id || profile.role !== 'appointed_person') return;
    const fetch = async () => {
      const { count } = await supabase
        .from('crane_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', profile.site_id)
        .eq('status', 'pending');
      setPendingCount(count ?? 0);
    };
    fetch();
    const interval = setInterval(fetch, 60_000);
    return () => clearInterval(interval);
  }, [profile?.site_id, profile?.role]);

  if (!profile) return null;

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(profile.role)
  );

  const isActive = (item: NavItem) =>
    item.exact
      ? location.pathname === item.href
      : location.pathname === item.href || location.pathname.startsWith(item.href + '/');

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="min-h-screen bg-background flex">

      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col bg-card shadow-[2px_0_12px_rgba(0,0,0,0.06)]">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
            <Construction className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight">Crane2.0</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Operations</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const badge = item.href === '/bookings' ? pendingCount : 0;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive(item)
                    ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {badge > 0 && (
                  <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors cursor-pointer text-left">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <UserCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{profile.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {getRoleLabel(profile.role)}
                  </p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56 mb-1">
              <DropdownMenuLabel>
                <p className="text-sm font-semibold">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">{profile.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut()}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ── Main content area ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">

        {/* ── Mobile top header ──────────────────────────────────────── */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center px-4 gap-3">
          {/* Logo mark */}
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/30">
            <Construction className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-bold text-foreground text-sm tracking-tight">Crane2.0</span>

          <div className="flex-1" />

          {/* Notification bell */}
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
            <Bell className="h-5 w-5" />
          </button>

          {/* User avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center cursor-pointer">
                <UserCircle className="h-5 w-5 text-primary" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="text-sm font-semibold">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground font-normal mt-0.5">{profile.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut()}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* ── Desktop page header ─────────────────────────────────────── */}
        <header className="hidden lg:flex h-16 items-center px-6 gap-4 border-b border-border bg-card sticky top-0 z-30">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{today}</p>
            <p className="text-sm font-semibold text-foreground">
              {getGreeting()}, {profile.full_name.split(' ')[0]}
            </p>
          </div>
          {profile.site && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs text-muted-foreground font-medium">
              <MapPin className="h-3.5 w-3.5" />
              {(profile.site as any).name}
            </div>
          )}
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
            <Bell className="h-5 w-5" />
          </button>
        </header>

        {/* ── Page content ───────────────────────────────────────────── */}
        <main className="flex-1 p-4 pb-24 lg:p-6 lg:pb-6 overflow-auto pt-[calc(3.5rem+1rem)] lg:pt-6">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card shadow-[0_-2px_12px_rgba(0,0,0,0.08)] border-t border-border">
        <div className="flex items-center justify-around px-1 py-2">
          {filteredNavItems.map((item) => {
            const active = isActive(item);
            const badge = item.href === '/bookings' ? pendingCount : 0;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-200 min-w-0',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <span className={cn(
                  'relative p-1.5 rounded-xl transition-all duration-200',
                  active ? 'bg-primary/15' : ''
                )}>
                  {item.icon}
                  {badge > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] font-bold px-0.5">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium truncate max-w-[56px] text-center leading-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
