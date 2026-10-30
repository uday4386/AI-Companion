import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail, Send, UserRound } from 'lucide-react';
import { AuthShell, FormError } from './AuthShell';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';

export default function RequestAccessPage() {
  const [form, setForm] = useState({ fullName: '', email: '', requestReason: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/api/auth/access-request', form);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit your request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthShell
        title="Request received"
        subtitle="An administrator will review your request and issue a one-time invitation link."
        footer={
          <Link to="/login" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand-600 hover:underline dark:text-brand-300">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
        }
      >
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-500/25 dark:bg-emerald-500/10">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm dark:bg-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <h2 className="mt-3 text-[14.5px] font-semibold text-emerald-900 dark:text-emerald-200">You are in the queue</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-emerald-800/80 dark:text-emerald-200/70">
            We sent <span className="font-semibold">{form.email}</span> to the admin team for review. Once approved you will receive an invite
            link to set your password. Access is never granted automatically.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Request access"
      subtitle="Access is invite-only. Tell us who you are and an administrator will review your request."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      }
    >
      <FormError message={error} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Full name" htmlFor="fullName" required>
          <Input id="fullName" placeholder="e.g. Ananya Rao" leadingIcon={UserRound} value={form.fullName} onChange={update('fullName')} required autoFocus />
        </Field>
        <Field label="Work email" htmlFor="email" required>
          <Input id="email" type="email" placeholder="you@company.com" leadingIcon={Mail} value={form.email} onChange={update('email')} required />
        </Field>
        <Field
          label="Why do you need access?"
          htmlFor="reason"
          required
          hint="Include your team and the applications you will report on. Minimum 10 characters."
        >
          <Textarea
            id="reason"
            rows={4}
            placeholder="I am on the QA team and will report defects for the Warehouse Console and Payments API."
            value={form.requestReason}
            onChange={update('requestReason')}
            required
          />
        </Field>
        <Button type="submit" fullWidth size="lg" loading={loading}>
          <Send className="h-4 w-4" /> Send request
        </Button>
      </form>
    </AuthShell>
  );
}
