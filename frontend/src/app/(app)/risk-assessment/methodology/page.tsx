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
    <>
      <div className="topbar">
        <div className="page-title">Assessment Methodology</div>
        {isAdmin && !editing && current && (
          <button onClick={startEditing} className="btn-secondary">
            Edit (publish new version)
          </button>
        )}
      </div>

      <div className="content">
        {loading && <p className="helper-note">Loading…</p>}

        {!editing && current && (
          <div className="card" style={{ maxWidth: 760 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span className="std-badge">
                <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
                {current.frameworkReference}
              </span>
              <span className="created-note">
                Version {current.version} · published {new Date(current.createdAt).toLocaleDateString()} by {current.author.name}
              </span>
            </div>
            <div
              style={{ fontFamily: 'var(--font-content)', fontSize: 14, lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: current.contentHtml }}
            />
          </div>
        )}

        {editing && (
          <div className="card" style={{ maxWidth: 760 }}>
            <p className="helper-note" style={{ marginTop: 0, marginBottom: 12 }}>
              Editing publishes a new version (rich text as HTML). The previous version remains in history.
            </p>
            <div className="field">
              <label className="field-label">Framework / standard reference</label>
              <input
                className="input"
                style={{ fontFamily: 'var(--font-chrome)' }}
                value={draftFramework}
                onChange={(e) => setDraftFramework(e.target.value)}
                placeholder="e.g. NIST SP 800-30 Rev. 1"
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">Content (HTML)</label>
              <textarea
                className="input"
                style={{ fontFamily: 'monospace', fontSize: 12, minHeight: 280 }}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>
            {error && (
              <p className="helper-note" style={{ color: 'var(--dgs-red)' }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={publish} disabled={submitting} className="btn-primary">
                {submitting ? 'Publishing…' : 'Publish new version'}
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
