import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { CompaniesPage } from '@/features/admin/CompaniesPage';
import { SitesPage } from '@/features/admin/SitesPage';
import { CranesPage } from '@/features/admin/CranesPage';
import { SiteUsersPage } from '@/features/admin/SiteUsersPage';
import CraneLogsPage from '@/features/logs/CraneLogsPage'
import { SchedulePage } from '@/features/schedules/SchedulePage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="companies" element={<ProtectedRoute allowedRoles={['admin']}><CompaniesPage /></ProtectedRoute>} />
            <Route path="sites" element={<ProtectedRoute allowedRoles={['admin', 'company_admin']}><SitesPage /></ProtectedRoute>} />
            <Route path="cranes" element={<ProtectedRoute allowedRoles={['appointed_person']}><CranesPage /></ProtectedRoute>} />
            <Route path="site-users" element={<ProtectedRoute allowedRoles={['appointed_person']}><SiteUsersPage /></ProtectedRoute>} />
            <Route path="logs" element={<ProtectedRoute allowedRoles={['appointed_person', 'crane_supervisor', 'crane_operator']}><CraneLogsPage /></ProtectedRoute>} />
            <Route path="schedule" element={<ProtectedRoute allowedRoles={['appointed_person', 'crane_supervisor', 'crane_operator', 'slinger_signaller', 'subcontractor']}><SchedulePage /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
