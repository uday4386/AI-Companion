import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFetch } from '@/hooks/useFetch';
import type { DashboardData } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { ProfileForm, SecurityForm } from '@/components/settings/ProfileForm';

export default function ProfilePage() {
  const { user, visibility } = useAuth();
  const [tab, setTab] = useState<'profile' | 'security'>('profile');
  const { data } = useFetch<DashboardData>('/api/reports/dashboard?dateFrom=' + new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10));

  if (!user) return null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={[{ label: 'Account' }, { label: 'My profile' }]}
        title="My profile"
        description="Your account details, access level and password."
        actions={
          <Link to="/errors?scope=mine">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
              My reports <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardBody className="text-center">
              <Avatar name={user.fullName} tone={user.avatarTone} size="lg" className="mx-auto h-14 w-14 text-base" />
              <h2 className="mt-3 text-[16px] font-bold text-slate-900 dark:text-white">{user.fullName}</h2>
              <p className="text-[12px] text-slate-500 dark:text-slate-400">{user.email}</p>
              <div className="mt-2 flex justify-center gap-1.5">
                <Badge color={user.role === 'admin' ? 'indigo' : 'slate'} size="sm">
                  <ShieldCheck className="h-3 w-3" /> {ROLE_LABEL[user.role]}
                </Badge>
                <Badge color={user.accountStatus === 'active' ? 'emerald' : 'rose'} size="sm">
                  {user.accountStatus}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
                <div>
                  <p className="text-[16px] font-bold text-slate-900 dark:text-white">{data?.cards.total ?? '—'}</p>
                  <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Reports</p>
                </div>
                <div>
                  <p className="text-[16px] font-bold text-slate-900 dark:text-white">{data?.cards.myAssignments ?? data?.cards.assigned ?? 0}</p>
                  <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Assigned</p>
                </div>
                <div>
                  <p className="text-[16px] font-bold text-slate-900 dark:text-white">{data?.cards.resolved ?? 0}</p>
                  <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Resolved</p>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={UserRound} title="Access" />
            <CardBody className="space-y-2 text-[11.5px] text-slate-600 dark:text-slate-300">
              <p className="flex justify-between gap-2">
                <span className="text-slate-400">Member since</span>
                <span className="font-medium">{formatDate(user.createdAt)}</span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-slate-400">Department</span>
                <span className="font-medium">{user.department || '—'}</span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-slate-400">Job title</span>
                <span className="font-medium">{user.jobTitle || '—'}</span>
              </p>
              <p className="flex justify-between gap-2">
                <span className="text-slate-400">Visibility</span>
                <span className="text-right font-medium">{visibility}</span>
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Tabs
            items={[
              { value: 'profile', label: 'Profile details', icon: UserRound },
              { value: 'security', label: 'Password', icon: KeyRound },
            ]}
            value={tab}
            onChange={(value) => setTab(value as 'profile' | 'security')}
            variant="pill"
          />
          <Card>
            <CardHeader
              icon={tab === 'profile' ? UserRound : KeyRound}
              title={tab === 'profile' ? 'Profile details' : 'Change password'}
              description={tab === 'profile' ? 'Shown on reports, comments and notifications' : 'At least 8 characters with letters and numbers'}
            />
            <CardBody>{tab === 'profile' ? <ProfileForm /> : <SecurityForm />}</CardBody>
          </Card>
          <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3 text-[11px] text-slate-400 dark:border-white/[0.07] dark:bg-white/[0.02]">
            Your role and account status can only be changed by an Admin. All changes are recorded in the audit log.
          </div>
        </div>
      </div>
    </div>
  );
}
