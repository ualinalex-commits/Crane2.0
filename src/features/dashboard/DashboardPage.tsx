import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Building2, MapPin, Construction as CraneIcon,
  ClipboardList, Calendar, Users, Shield,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { UserRole } from '@/types';
import LiveDashboard from './LiveDashboard';

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

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  roles: UserRole[];
}

const quickActions: QuickAction[] = [
  {
    label: 'Companies',
    description: 'Manage companies',
    href: '/companies',
    icon: <Building2 className="h-6 w-6" />,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    roles: ['admin'],
  },
  {
    label: 'Sites',
    description: 'Construction sites',
    href: '/sites',
    icon: <MapPin className="h-6 w-6" />,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    roles: ['admin', 'company_admin'],
  },
  {
    label: 'Cranes',
    description: 'Manage site cranes',
    href: '/cranes',
    icon: <CraneIcon className="h-6 w-6" />,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    roles: ['appointed_person'],
  },
  {
    label: 'Site Users',
    description: 'Manage personnel',
    href: '/site-users',
    icon: <Users className="h-6 w-6" />,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    roles: ['appointed_person'],
  },
  {
    label: 'Crane Logs',
    description: 'Operation logs',
    href: '/logs',
    icon: <ClipboardList className="h-6 w-6" />,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    roles: ['appointed_person', 'crane_supervisor', 'crane_operator'],
  },
  {
    label: 'Schedule',
    description: 'Crane bookings',
    href: '/schedule',
    icon: <Calendar className="h-6 w-6" />,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-600',
    roles: ['appointed_person', 'crane_supervisor', 'crane_operator', 'slinger_signaller', 'subcontractor'],
  },
];

export function DashboardPage() {
  const { profile } = useAuth();

  if (!profile) return null;

  if (profile.role === 'appointed_person') {
    return <LiveDashboard />;
  }

  const filteredActions = quickActions.filter((a) => a.roles.includes(profile.role));
  const firstName = profile.full_name.split(' ')[0];
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      {/* Welcome header */}
      <div>
        <p className="text-sm text-muted-foreground font-medium">{today}</p>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground mt-1">
          {getGreeting()}, {firstName}
        </h1>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Shield className="h-3 w-3" />
            {getRoleLabel(profile.role)}
          </span>
          {profile.site && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
              <MapPin className="h-3 w-3" />
              {(profile.site as any)?.name}
            </span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-base font-bold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredActions.map((action) => (
            <Link key={action.href} to={action.href}>
              <div className="bg-card rounded-2xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] transition-all duration-200 cursor-pointer group">
                <div className={`w-11 h-11 rounded-xl ${action.iconBg} ${action.iconColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}>
                  {action.icon}
                </div>
                <h3 className="font-semibold text-foreground text-sm">{action.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
