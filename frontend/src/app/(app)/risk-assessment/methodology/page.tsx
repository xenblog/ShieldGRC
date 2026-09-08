'use client';

import { useState } from 'react';
import { useApiGet } from '@/lib/hooks';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { MethodologyVersion } from '@/lib/types';

export default function MethodologyPage() {
  const { user } = useAuth();
  const { data: current, loading, setData } = useApiGet<MethodologyVersion>('/methodology/current');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftFramework, setDraftFramework] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  function startEditing() {
    setDraft(current?.contentHtml ?? '');
    setDraftFramework(current?.frameworkReference ?? '');
    setEditing(true);
  }

  async function publish() {
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<MethodologyVersion>('/methodology', {
        frameworkReference: draftFramework,
        contentHtml: draft,
      });
      setData(created);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Assessment Methodology</h1>
        {isAdmin && !editing && (
          <button onClick={startEditing} className="text-sm text-[var(--dgs-primary)] hover:underline">
            Edit (publish new version)
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}

      {!editing && current && (
        <div className="dgs-card p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded bg-[var(--dgs-primary)]/10 px-2 py-1 text-xs font-semibold text-[var(--dgs-primary)]">
              {current.frameworkReference}
            </span>
            <p className="text-xs text-[var(--dgs-text-muted)]">
              Version {current.version} · published {new Date(current.createdAt).toLocaleDateString()} by{' '}
              {current.author.name}
            </p>
          </div>
          <div
            className="max-w-none text-sm leading-relaxed [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: current.contentHtml }}
          />
        </div>
      )}

      {editing && (
        <div className="dgs-card space-y-3 p-4">
          <p className="text-xs text-[var(--dgs-text-muted)]">
            Editing publishes a new version (rich text as HTML). The previous version remains in history.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-[var(--dgs-text-muted)]">
              Framework / standard reference
            </label>
            <input
              value={draftFramework}
              onChange={(e) => setDraftFramework(e.target.value)}
              placeholder="e.g. NIST SP 800-30 Rev. 1"
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={16}
            className="w-full rounded border px-3 py-2 font-mono text-xs"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={publish}
              disabled={submitting}
              className="rounded bg-[var(--dgs-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--dgs-primary-hover)]"
            >
              {submitting ? 'Publishing…' : 'Publish new version'}
            </button>
            <button onClick={() => setEditing(false)} className="rounded border px-3 py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
