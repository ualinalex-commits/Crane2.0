import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, MapPin, Construction as CraneIcon, ClipboardList, Calendar, Users, Shield } from 'lucide-react';
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

interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  gradient: string;
  roles: UserRole[];
}

const quickActions: QuickAction[] = [
  {
    label: 'Companies',
    description: 'Manage companies',
    href: '/companies',
    icon: <Building2 className="h-6 w-6" />,
    gradient: 'from-blue-500 to-blue-600',
    roles: ['admin'],
  },
  {
    label: 'Sites',
    description: 'Manage construction sites',
    href: '/sites',
    icon: <MapPin className="h-6 w-6" />,
    gradient: 'from-emerald-500 to-emerald-600',
    roles: ['admin', 'company_admin'],
  },
  {
    label: 'Cranes',
    description: 'Manage site cranes',
    href: '/cranes',
    icon: <CraneIcon className="h-6 w-6" />,
    gradient: 'from-orange-500 to-orange-600',
    roles: ['appointed_person'],
  },
  {
    label: 'Site Users',
    description: 'Manage site personnel',
    href: '/site-users',
    icon: <Users className="h-6 w-6" />,
    gradient: 'from-purple-500 to-purple-600',
    roles: ['appointed_person'],
  },
  {
    label: 'Crane Logs',
    description: 'View and create crane logs',
    href: '/logs',
    icon: <ClipboardList className="h-6 w-6" />,
    gradient: 'from-amber-500 to-amber-600',
    roles: ['appointed_person', 'crane_supervisor', 'crane_operator'],
  },
  {
    label: 'Schedule',
    description: 'View crane bookings',
    href: '/schedule',
    icon: <Calendar className="h-6 w-6" />,
    gradient: 'from-rose-500 to-rose-600',
    roles: ['appointed_person', 'crane_supervisor', 'crane_operator', 'slinger_signaller', 'subcontractor'],
  },
];

export function DashboardPage() {
  const { profile } = useAuth();

  if (!profile) return null;

  // Appointed Person gets the live operations dashboard
  if (profile.role === 'appointed_person') {
    return <LiveDashboard />;
  }

  // All other roles get quick-actions dashboard
  const filteredActions = quickActions.filter((a) => a.roles.includes(profile.role));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          Welcome back, {profile.full_name.split(' ')[0]}
        </h1>
        <div className="flex items-center gap-2 mt-2 text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span className="text-sm">{getRoleLabel(profile.role)}</span>
          {profile.site && (
            <>
              <span className="text-border">•</span>
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{(profile.site as any)?.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActions.map((action) => (
            <Link key={action.href} to={action.href}>
              <Card className="group hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-pointer h-full">
                <CardContent className="p-6 flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center text-white shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {action.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {action.label}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{action.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
