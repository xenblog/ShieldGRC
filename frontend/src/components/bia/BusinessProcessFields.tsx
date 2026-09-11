import { BusinessProcessCriticalityTier, OrgUnit, UserSummary } from '@/lib/types';
import { CRITICALITY_TIER_LABEL } from '@/lib/status-labels';

const TIERS: BusinessProcessCriticalityTier[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export interface BusinessProcessFieldValues {
  name: string;
  description: string;
  orgUnitId: string;
  ownerId: string;
  criticalityTier: BusinessProcessCriticalityTier;
  rtoMinutes: number | '';
  rpoMinutes: number | '';
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
    </>
  );
}
