import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Info,
  Lightbulb,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api, ApiError } from '@/lib/api';
import { CATEGORIES, PRIORITY_LABEL, PRIORITY_ORDER } from '@/lib/constants';
import { formatBytes } from '@/lib/format';
import type { ErrorItem } from '@/lib/types';
import { PageHeader } from '@/components/layout/Topbar';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface FormState {
  title: string;
  applicationId: string;
  module: string;
  category: string;
  priority: string;
  description: string;
  reproductionSteps: string;
  expectedResult: string;
  actualResult: string;
}

const INITIAL: FormState = {
  title: '',
  applicationId: '',
  module: '',
  category: 'Functional',
  priority: 'medium',
  description: '',
  reproductionSteps: '',
  expectedResult: '',
  actualResult: '',
};

const PRIORITY_GUIDE = [
  { value: 'critical', label: 'Critical', text: 'Service down, data loss or a security risk. Needs an immediate owner.' },
  { value: 'high', label: 'High', text: 'Major functionality broken with no reasonable workaround.' },
  { value: 'medium', label: 'Medium', text: 'Noticeable impact, but a workaround exists.' },
  { value: 'low', label: 'Low', text: 'Cosmetic or minor inconvenience.' },
];

export default function SubmitErrorPage() {
  const { meta } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [files, setFiles] = useState<File[]>([]);
  const [applications, setApplications] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    void api
      .get<{ applications: { id: string; name: string; isActive: boolean }[] }>('/api/applications')
      .then((data) => {
        const active = data.applications.filter((app) => app.isActive);
        setApplications(active);
        setForm((prev) => ({ ...prev, applicationId: prev.applicationId || active[0]?.id || '' }));
      })
      .catch(() => undefined);
  }, []);

  const maxMb = meta?.limits.maxAttachmentMb ?? 5;
  const allowedTypes = meta?.limits.allowedMimeTypes;

  const set = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setFieldErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const addFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    const problems: string[] = [];
    const accepted: File[] = [];
    for (const file of list) {
      if (allowedTypes && !allowedTypes.includes(file.type)) {
        problems.push(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > maxMb * 1024 * 1024) {
        problems.push(`${file.name}: larger than ${maxMb} MB`);
        continue;
      }
      if (files.length + accepted.length >= 10) {
        problems.push('Maximum 10 attachments per report');
        break;
      }
      if (!accepted.some((f) => f.name === file.name && f.size === file.size)) accepted.push(file);
    }
    if (problems.length) toast.warning('Some files were skipped', problems.join(' · '));
    setFiles((prev) => [...prev, ...accepted]);
  };

  const completeness = useMemo(() => {
    const checks = [form.title.trim().length >= 6, Boolean(form.applicationId), Boolean(form.module.trim()), form.description.trim().length >= 15, form.priority];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [form]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (form.title.trim().length < 6) errors.title = 'Give the report a clear title (at least 6 characters).';
    if (!form.applicationId) errors.applicationId = 'Choose the affected application.';
    if (!form.module.trim()) errors.module = 'Which module or screen is affected?';
    if (form.description.trim().length < 15) errors.description = 'Describe what happens in at least 15 characters.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError('Please complete the required fields highlighted below.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.post<{ error: ErrorItem }>('/api/errors', form);
      let uploadWarning = '';
      if (files.length) {
        const body = new FormData();
        for (const file of files) body.append('files', file);
        try {
          await api.upload(`/api/errors/${created.error.id}/attachments`, body);
        } catch (uploadError) {
          uploadWarning = uploadError instanceof ApiError ? uploadError.message : 'Attachments could not be uploaded.';
        }
      }
      toast.success(`Report ${created.error.errorCode} submitted`, 'Admins have been notified and will review it shortly.');
      if (uploadWarning) toast.warning('Evidence not uploaded', uploadWarning);
      navigate(`/errors/${created.error.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFieldErrors(err.fields);
      setError(err instanceof ApiError ? err.message : 'Could not submit the report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        breadcrumb={[{ label: 'Workspace' }, { label: 'Errors', to: '/errors' }, { label: 'New report' }]}
        title="Submit a new error"
        description="Capture what happened with enough context for an Admin to triage it without asking follow-up questions."
        actions={
          <Link to="/errors">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to queue
            </Button>
          </Link>
        }
      />

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {error ? (
            <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}

          <Card>
            <CardHeader icon={FileText} title="Report basics" description="The identifier, location and severity of the defect" />
            <CardBody className="space-y-4">
              <Field label="Title" htmlFor="title" required error={fieldErrors.title} hint="Short and specific — e.g. “Stock adjustment reason list takes 12 seconds to load”.">
                <Input id="title" value={form.title} onChange={set('title')} placeholder="What is going wrong?" invalid={Boolean(fieldErrors.title)} maxLength={180} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Application" htmlFor="application" required error={fieldErrors.applicationId}>
                  <Select id="application" value={form.applicationId} onChange={set('applicationId')} invalid={Boolean(fieldErrors.applicationId)}>
                    <option value="">Select an application</option>
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Module" htmlFor="module" required error={fieldErrors.module}>
                  <Input id="module" list="module-options" value={form.module} onChange={set('module')} placeholder="e.g. Reports" invalid={Boolean(fieldErrors.module)} />
                  <datalist id="module-options">
                    {(meta?.modules ?? []).map((module) => (
                      <option key={module} value={module} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Category" htmlFor="category" required>
                  <Select id="category" value={form.category} onChange={set('category')}>
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Priority" htmlFor="priority" required>
                  <Select id="priority" value={form.priority} onChange={set('priority')}>
                    {PRIORITY_ORDER.map((priority) => (
                      <option key={priority} value={priority}>
                        {PRIORITY_LABEL[priority]}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={Sparkles} title="What happened" description="Observed behaviour, reproduction steps and the gap versus expectations" />
            <CardBody className="space-y-4">
              <Field label="Description" htmlFor="description" required error={fieldErrors.description} hint="Explain the observed behaviour and its impact. Include any error messages.">
                <Textarea id="description" rows={5} value={form.description} onChange={set('description')} invalid={Boolean(fieldErrors.description)} placeholder="When I open the report and choose a quarterly range, the export download contains only the header row…" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Steps to reproduce" htmlFor="steps" hint="One step per line — numbered steps help engineers reproduce faster.">
                  <Textarea id="steps" rows={6} value={form.reproductionSteps} onChange={set('reproductionSteps')} placeholder={'1. Open Reports → Order Summary\n2. Choose a 90-day range\n3. Click Export → Excel'} />
                </Field>
                <div className="space-y-4">
                  <Field label="Expected result" htmlFor="expected">
                    <Textarea id="expected" rows={3} value={form.expectedResult} onChange={set('expectedResult')} placeholder="What should happen instead?" className="min-h-[74px]" />
                  </Field>
                  <Field label="Actual result" htmlFor="actual">
                    <Textarea id="actual" rows={2} value={form.actualResult} onChange={set('actualResult')} placeholder="What happened in reality?" className="min-h-[74px]" />
                  </Field>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={Paperclip}
              title="Evidence"
              description={`Screenshots, logs or documents · up to 10 files, ${maxMb} MB each`}
              action={files.length ? <Badge color="indigo" size="sm">{files.length} selected</Badge> : null}
            />
            <CardBody>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  if (event.dataTransfer.files) addFiles(event.dataTransfer.files);
                }}
                className={clsx(
                  'flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-7 text-center transition',
                  dragging
                    ? 'border-brand-400 bg-brand-50/60 dark:border-brand-400/60 dark:bg-brand-500/[0.08]'
                    : 'border-slate-200 bg-slate-50/50 hover:border-brand-300 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-brand-500/30',
                )}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm dark:bg-slate-900 dark:text-brand-300">
                  <Upload className="h-4.5 w-4.5" />
                </span>
                <p className="mt-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-200">Drop files here or browse</p>
                <p className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">PNG, JPG, GIF, WebP, PDF, TXT, CSV, JSON, ZIP, DOCX, XLSX</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={() => fileInput.current?.click()}>
                  Choose files
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  className="sr-only"
                  accept={allowedTypes?.join(',')}
                  onChange={(event) => {
                    if (event.target.files) addFiles(event.target.files);
                    event.target.value = '';
                  }}
                />
              </div>

              {files.length ? (
                <ul className="mt-3 space-y-2">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                        <Paperclip className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-slate-700 dark:text-slate-200">{file.name}</span>
                        <span className="block text-[10.5px] text-slate-400">{formatBytes(file.size)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                        aria-label={`Remove ${file.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardBody>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-white/[0.08] dark:bg-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9">
                <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-100 dark:text-white/10" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(completeness / 100) * 94.2} 94.2`}
                    className="text-brand-500 transition-all"
                  />
                </svg>
              </div>
              <div>
                <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-100">{completeness}% complete</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Required fields and evidence</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/errors">
                <Button variant="ghost" size="md">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" size="md" loading={submitting}>
                <Send className="h-4 w-4" /> Submit report
              </Button>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader icon={Info} title="How priority is used" />
            <CardBody className="space-y-3 pt-3">
              {PRIORITY_GUIDE.map((item) => (
                <div key={item.value} className="flex gap-2.5">
                  <Badge color={item.value === 'critical' ? 'rose' : item.value === 'high' ? 'orange' : item.value === 'medium' ? 'amber' : 'slate'} size="sm" className="mt-0.5 shrink-0">
                    {item.label}
                  </Badge>
                  <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">{item.text}</p>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={Lightbulb} title="A great report includes" />
            <CardBody className="pt-3">
              <ul className="space-y-2 text-[12px] text-slate-600 dark:text-slate-300">
                {[
                  'The exact screen and module affected',
                  'Numbered reproduction steps',
                  'Expected versus actual behaviour',
                  'A screenshot or the client-side error text',
                  'Whether the issue is blocking anyone today',
                ].map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    {tip}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <div className="rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-50 to-violet-50 p-4 dark:border-brand-500/20 dark:from-brand-500/[0.08] dark:to-violet-500/[0.06]">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">What happens next</p>
            <ol className="mt-2 space-y-2 text-[11.5px] leading-relaxed text-brand-900/70 dark:text-brand-100/70">
              <li>
                <span className="font-semibold text-brand-800 dark:text-brand-200">1. Intake.</span> The report is created with a unique ID and status{' '}
                <span className="font-semibold">Submitted</span>. Admins are notified.
              </li>
              <li>
                <span className="font-semibold text-brand-800 dark:text-brand-200">2. Triage.</span> An Admin reviews, assigns an owner and moves the status
                forward.
              </li>
              <li>
                <span className="font-semibold text-brand-800 dark:text-brand-200">3. Resolution.</span> You will be notified of each change and can add
                comments at any time.
              </li>
            </ol>
          </div>
        </aside>
      </form>
    </div>
  );
}
