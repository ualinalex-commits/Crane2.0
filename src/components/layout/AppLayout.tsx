import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { CraneMastBackground } from './CraneMastBackground';
import { useAuth } from '@/contexts/AuthContext';
import { useTestMode, useEffectiveProfile } from '@/contexts/TestModeContext';
import {
  Building2, MapPin, Construction, ClipboardList, Calendar, Users, LogOut,
  ChevronDown, Shield, UserCircle, LayoutDashboard, Bell, FileText, Eye, X,
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
    label: 'Daily Briefing',
    href: '/briefing',
    icon: <FileText className="h-5 w-5" />,
    roles: ['admin', 'company_admin', 'appointed_person', 'crane_supervisor', 'crane_operator', 'slinger_signaller', 'subcontractor'],
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

const BANNER_H = 40;

export function AppLayout() {
  const { profile: realProfile, signOut } = useAuth();
  const { viewAsProfile, setViewAsProfile, allProfiles } = useTestMode();
  const profile = useEffectiveProfile();
  const location = useLocation();

  if (!profile) return null;

  const bannerActive = !!viewAsProfile;
  const bannerOffset = bannerActive ? BANNER_H : 0;

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

  const testUserDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer',
          bannerActive
            ? 'border-orange-400 bg-orange-100 text-orange-700 hover:bg-orange-200'
            : 'border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100'
        )}>
          <Eye className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {bannerActive ? viewAsProfile!.full_name.split(' ')[0] : 'Test as user'}
          </span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-orange-600 text-xs font-semibold uppercase tracking-wide">
          Developer Testing Tool
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {bannerActive && (
          <>
            <DropdownMenuItem
              onClick={() => setViewAsProfile(null)}
              className="text-orange-600 focus:text-orange-700 cursor-pointer"
            >
              <X className="mr-2 h-4 w-4" />
              Exit test mode — back to {realProfile?.full_name}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {allProfiles.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">Loading users…</div>
        )}
        {allProfiles.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => setViewAsProfile(p)}
            className={cn('cursor-pointer', viewAsProfile?.id === p.id && 'bg-orange-50')}
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-medium text-sm truncate">{p.full_name}</span>
              <span className="text-xs text-muted-foreground truncate">
                {p.email} · {getRoleLabel(p.role)}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (

    <div className="min-h-screen bg-background">

      {/* ── Animated crane mast background ──────────────────────────────── */}
      <CraneMastBackground />

      {/* ── Orange testing banner ────────────────────────────────────────── */}
      {bannerActive && (
        <div
          className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-3 px-4 bg-orange-500"
          style={{ height: BANNER_H }}
        >
          <Eye className="h-4 w-4 text-white shrink-0" />
          <span className="text-white text-sm font-medium">
            Viewing as <strong>{viewAsProfile!.full_name}</strong> ({getRoleLabel(viewAsProfile!.role)}) — Testing Mode
          </span>
          <button
            onClick={() => setViewAsProfile(null)}
            className="ml-1 text-white/80 hover:text-white transition-colors cursor-pointer"
            aria-label="Exit test mode"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="min-h-screen bg-background flex" style={{ paddingTop: bannerOffset }}>

        {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
        <aside
          className="hidden lg:flex fixed left-0 bottom-0 z-40 w-60 flex-col bg-card border-r border-border"
          style={{ top: bannerOffset }}
        >

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
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-3 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors cursor-pointer text-left">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                    bannerActive ? 'bg-orange-100' : 'bg-primary/15'
                  )}>
                    <UserCircle className={cn('h-5 w-5', bannerActive ? 'text-orange-500' : 'text-primary')} />
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
                  {bannerActive && (
                    <p className="text-xs text-orange-500 font-normal mt-0.5">Testing mode</p>
                  )}
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
        <div className="flex-1 flex flex-col min-w-0 lg:pl-60 relative z-[1]">

          {/* ── Mobile top header ──────────────────────────────────────── */}
          <header
            className="lg:hidden fixed left-0 right-0 z-50 h-14 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex items-center px-4 gap-3"
            style={{ top: bannerOffset }}
          >
            {/* Logo mark */}
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/30">
              <Construction className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="font-bold text-foreground text-sm tracking-tight">Crane2.0</span>

            <div className="flex-1" />

            {/* Test as user dropdown */}
            {testUserDropdown}

            {/* Notification bell */}
            <button className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
              <Bell className="h-5 w-5" />
            </button>

            {/* User avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center cursor-pointer',
                  bannerActive ? 'bg-orange-100' : 'bg-primary/15'
                )}>
                  <UserCircle className={cn('h-5 w-5', bannerActive ? 'text-orange-500' : 'text-primary')} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{profile.full_name}</p>
                  <p className="text-xs text-muted-foreground font-normal mt-0.5">{profile.email}</p>
                  {bannerActive && (
                    <p className="text-xs text-orange-500 font-normal mt-0.5">Testing mode</p>
                  )}
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
          <header
            className="hidden lg:flex h-16 items-center px-6 gap-4 border-b border-border bg-card sticky z-30"
            style={{ top: bannerOffset }}
          >
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

            {/* Test as user dropdown */}
            {testUserDropdown}

            <button className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors cursor-pointer">
              <Bell className="h-5 w-5" />
            </button>
          </header>

          {/* ── Page content ───────────────────────────────────────────── */}
          <main className={cn(
            'flex-1 p-4 pb-24 lg:p-6 lg:pb-6 overflow-auto lg:pt-6',
            bannerActive ? 'pt-[calc(3.5rem+1rem+2.5rem)]' : 'pt-[calc(3.5rem+1rem)]'
          )}>
            <Outlet />
          </main>
        </div>

        {/* ── Mobile bottom nav ───────────────────────────────────────────── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card shadow-[0_-2px_12px_rgba(0,0,0,0.08)] border-t border-border">
          <div className="flex items-center justify-around px-1 py-2">
            {filteredNavItems.map((item) => {
              const active = isActive(item);
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
    </div>
  );
}
