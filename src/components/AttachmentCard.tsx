import { useEffect, useState } from 'react';
import { Download, File, FileArchive, FileSpreadsheet, FileText, ImageOff, Loader2, Lock, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import type { Attachment } from '@/lib/types';
import { useToast } from '@/contexts/ToastContext';

const ICONS: { test: (mime: string) => boolean; icon: typeof File; tone: string }[] = [
  { test: (m) => m.includes('pdf'), icon: FileText, tone: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300' },
  { test: (m) => m.includes('sheet') || m.includes('csv'), icon: FileSpreadsheet, tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' },
  { test: (m) => m.includes('zip'), icon: FileArchive, tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' },
  { test: (m) => m.includes('text') || m.includes('json'), icon: FileText, tone: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300' },
];

function iconFor(mime: string) {
  return ICONS.find((entry) => entry.test(mime)) ?? { icon: File, tone: 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300' };
}

export function AttachmentCard({
  attachment,
  onDelete,
  canDelete,
  onPreview,
}: {
  attachment: Attachment;
  onDelete?: () => void;
  canDelete?: boolean;
  onPreview?: (attachment: Attachment, url: string) => void;
}) {
  const isImage = attachment.mimeType.startsWith('image/');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();
  const Icon = iconFor(attachment.mimeType).icon;
  const iconTone = iconFor(attachment.mimeType).tone;

  useEffect(() => {
    if (!isImage) return;
    let revoked: string | null = null;
    let cancelled = false;
    void api
      .blob(attachment.url)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setPreviewUrl(url);
      })
      .catch(() => setPreviewFailed(true));
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [attachment.url, isImage]);

  const download = async () => {
    try {
      await api.download(`${attachment.url}?download=1`, attachment.originalFilename);
    } catch (error) {
      toast.error('Download failed', (error as Error).message);
    }
  };

  return (
    <div className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-brand-300 hover:shadow-sm dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-brand-500/30">
      <div className="relative flex h-32 items-center justify-center bg-slate-50 dark:bg-white/[0.02]">
        {isImage && previewUrl ? (
          <button
            type="button"
            onClick={() => onPreview?.(attachment, previewUrl)}
            className="h-full w-full"
            aria-label={`Preview ${attachment.originalFilename}`}
          >
            <img src={previewUrl} alt={attachment.originalFilename} className="h-full w-full object-cover transition group-hover:opacity-90" />
          </button>
        ) : isImage && !previewFailed ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : isImage ? (
          <ImageOff className="h-6 w-6 text-slate-300" />
        ) : (
          <span className={clsx('flex h-11 w-11 items-center justify-center rounded-xl', iconTone)}>
            <Icon className="h-5 w-5" />
          </span>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-slate-900/70 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-white backdrop-blur">
          <Lock className="h-2.5 w-2.5" /> private
        </span>
      </div>
      <div className="p-2.5">
        <p className="truncate text-[11.5px] font-semibold text-slate-700 dark:text-slate-200" title={attachment.originalFilename}>
          {attachment.originalFilename}
        </p>
        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="text-[10px] text-slate-400">{formatBytes(attachment.sizeBytes)}</span>
          <div className="flex items-center gap-0.5">
            {onPreview && isImage && previewUrl ? (
              <button
                type="button"
                onClick={() => onPreview(attachment, previewUrl)}
                className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-white/10"
                aria-label="Preview image"
                title="Preview"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" strokeLinecap="round" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void download()}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-white/10"
              aria-label={`Download ${attachment.originalFilename}`}
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            {canDelete && onDelete ? (
              <button
                type="button"
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDelete();
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10"
                aria-label={`Delete ${attachment.originalFilename}`}
                title="Delete"
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
