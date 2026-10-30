import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from '@/components/RouteGuards';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageLoader } from '@/components/ui/Spinner';

const LoginPage = lazy(() => import('@/pages/auth/Login'));
const RequestAccessPage = lazy(() => import('@/pages/auth/RequestAccess'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPassword'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPassword'));
const AcceptInvitationPage = lazy(() => import('@/pages/auth/AcceptInvitation'));

const DashboardPage = lazy(() => import('@/pages/Dashboard'));
const ErrorsListPage = lazy(() => import('@/pages/ErrorsList'));
const SubmitErrorPage = lazy(() => import('@/pages/SubmitError'));
const ErrorDetailPage = lazy(() => import('@/pages/ErrorDetail'));
const AssignmentsPage = lazy(() => import('@/pages/Assignments'));
const ReportsPage = lazy(() => import('@/pages/Reports'));
const UsersPage = lazy(() => import('@/pages/Users'));
const AccessRequestsPage = lazy(() => import('@/pages/AccessRequests'));
const NotificationsPage = lazy(() => import('@/pages/Notifications'));
const AuditLogsPage = lazy(() => import('@/pages/AuditLogs'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const ProfilePage = lazy(() => import('@/pages/Profile'));
const NotFoundPage = lazy(() => import('@/pages/NotFound'));

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center">
                    <PageLoader />
                  </div>
                }
              >
                <Routes>
                  <Route element={<PublicOnlyRoute />}>
                    <Route path="/login" element={<LoginPage />} />
                  </Route>

                  <Route path="/request-access" element={<RequestAccessPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/invite/:token" element={<AcceptInvitationPage />} />

                  <Route element={<ProtectedRoute />}>
                    <Route element={<AppLayout />}>
                      <Route path="/dashboard" element={<DashboardPage />} />
                      <Route path="/errors" element={<ErrorsListPage />} />
                      <Route path="/errors/new" element={<SubmitErrorPage />} />
                      <Route path="/errors/:id" element={<ErrorDetailPage />} />
                      <Route path="/notifications" element={<NotificationsPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/profile" element={<ProfilePage />} />

                      <Route element={<AdminRoute />}>
                        <Route path="/assignments" element={<AssignmentsPage />} />
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/users" element={<UsersPage />} />
                        <Route path="/access-requests" element={<AccessRequestsPage />} />
                        <Route path="/audit-logs" element={<AuditLogsPage />} />
                      </Route>
                    </Route>
                  </Route>

                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
