import { BusinessProcessCriticalityTier, OrgUnit, UserSummary } from '@/lib/types';
import { CRITICALITY_TIER_LABEL } from '@/lib/status-labels';

const TIERS: BusinessProcessCriticalityTier[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
export const CIA_SCALE_LABELS: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' };

export interface BusinessProcessFieldValues {
  name: string;
  description: string;
  orgUnitId: string;
  ownerId: string;
  criticalityTier: BusinessProcessCriticalityTier;
  rtoMinutes: number | '';
  rpoMinutes: number | '';
  confidentialityScore: number | '';
  integrityScore: number | '';
  availabilityScore: number | '';
}

export function emptyBusinessProcessFieldValues(): BusinessProcessFieldValues {
  return {
    name: '',
    description: '',
    orgUnitId: '',
    ownerId: '',
    criticalityTier: 'MEDIUM',
    rtoMinutes: '',
    rpoMinutes: '',
    confidentialityScore: '',
    integrityScore: '',
    availabilityScore: '',
  };
}

export function BusinessProcessFields({
  values,
  onChange,
  orgUnits,
  users,
  disabled,
}: {
  values: BusinessProcessFieldValues;
  onChange: <K extends keyof BusinessProcessFieldValues>(key: K, value: BusinessProcessFieldValues[K]) => void;
  orgUnits: OrgUnit[] | null;
  users: UserSummary[] | null;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="field">
        <label className="field-label">Process Name</label>
        <input
          className="input"
          style={{ fontFamily: 'var(--font-chrome)' }}
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          disabled={disabled}
          required
        />
      </div>
      <div className="field">
        <label className="field-label">Description</label>
        <textarea className="input" value={values.description} onChange={(e) => onChange('description', e.target.value)} disabled={disabled} />
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field-label">Org Unit</label>
          <select className="select-input" value={values.orgUnitId} onChange={(e) => onChange('orgUnitId', e.target.value)} disabled={disabled} required>
            <option value="">Select…</option>
            {orgUnits?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Process Owner</label>
          <select className="select-input" value={values.ownerId} onChange={(e) => onChange('ownerId', e.target.value)} disabled={disabled} required>
            <option value="">Select…</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="field-label">Criticality Tier</label>
        <select
          className="select-input"
          value={values.criticalityTier}
          onChange={(e) => onChange('criticalityTier', e.target.value as BusinessProcessCriticalityTier)}
          disabled={disabled}
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {CRITICALITY_TIER_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="field-row" style={{ marginBottom: 0 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">RTO (minutes)</label>
          <input
            className="input"
            style={{ fontFamily: 'var(--font-chrome)' }}
            type="number"
            min={0}
            value={values.rtoMinutes}
            onChange={(e) => onChange('rtoMinutes', e.target.value === '' ? '' : Number(e.target.value))}
            disabled={disabled}
          />
          <div className="helper-note">Recovery Time Objective — how quickly this process must be restored.</div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">RPO (minutes)</label>
          <input
            className="input"
            style={{ fontFamily: 'var(--font-chrome)' }}
            type="number"
            min={0}
            value={values.rpoMinutes}
            onChange={(e) => onChange('rpoMinutes', e.target.value === '' ? '' : Number(e.target.value))}
            disabled={disabled}
          />
          <div className="helper-note">Recovery Point Objective — maximum tolerable data loss window.</div>
        </div>
      </div>

      <div className="field" style={{ marginTop: 16, marginBottom: 8 }}>
        <label className="field-label">CIA Rating (1–3)</label>
      </div>
      <div className="field-row" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 0 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Confidentiality</label>
          <select
            className="select-input"
            value={values.confidentialityScore}
            onChange={(e) => onChange('confidentialityScore', e.target.value === '' ? '' : Number(e.target.value))}
            disabled={disabled}
          >
            <option value="">Not set</option>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n} — {CIA_SCALE_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Integrity</label>
          <select
            className="select-input"
            value={values.integrityScore}
            onChange={(e) => onChange('integrityScore', e.target.value === '' ? '' : Number(e.target.value))}
            disabled={disabled}
          >
            <option value="">Not set</option>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n} — {CIA_SCALE_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label className="field-label">Availability</label>
          <select
            className="select-input"
            value={values.availabilityScore}
            onChange={(e) => onChange('availabilityScore', e.target.value === '' ? '' : Number(e.target.value))}
            disabled={disabled}
          >
            <option value="">Not set</option>
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n} — {CIA_SCALE_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
