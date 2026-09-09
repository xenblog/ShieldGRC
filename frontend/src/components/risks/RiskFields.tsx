import { Category, OrgUnit, RiskStatus, TreatmentStrategy, UserSummary } from '@/lib/types';
import { RISK_STATUS_LABEL } from '@/lib/status-labels';

const STATUSES: RiskStatus[] = ['IDENTIFIED', 'ASSESSED', 'MITIGATING', 'ACCEPTED', 'CLOSED'];
const TREATMENT_STRATEGIES: TreatmentStrategy[] = ['AVOID', 'REDUCE', 'TRANSFER', 'ACCEPT'];
export const SCALE_LABELS: Record<number, string> = { 1: 'Very Low', 2: 'Low', 3: 'Medium', 4: 'High', 5: 'Very High' };

export interface RiskFieldValues {
  title: string;
  description: string;
  categoryId: string;
  orgUnitId: string;
  ownerId: string;
  status: RiskStatus;
  likelihood: number;
  impact: number;
  treatmentStrategy: TreatmentStrategy | '';
  treatmentNote: string;
  residualScore: number | '';
  notes: string;
  nextReviewDate: string;
}

export function emptyRiskFieldValues(): RiskFieldValues {
  return {
    title: '',
    description: '',
    categoryId: '',
    orgUnitId: '',
    ownerId: '',
    status: 'IDENTIFIED',
    likelihood: 3,
    impact: 3,
    treatmentStrategy: '',
    treatmentNote: '',
    residualScore: '',
    notes: '',
    nextReviewDate: '',
  };
}

export function RiskFields({
  values,
  onChange,
  categories,
  orgUnits,
  users,
  disabled,
}: {
  values: RiskFieldValues;
  onChange: <K extends keyof RiskFieldValues>(key: K, value: RiskFieldValues[K]) => void;
  categories: Category[] | null;
  orgUnits: OrgUnit[] | null;
  users: UserSummary[] | null;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="field">
        <label className="field-label">Title</label>
        <input
          className="input"
          style={{ fontFamily: 'var(--font-chrome)' }}
          value={values.title}
          onChange={(e) => onChange('title', e.target.value)}
          disabled={disabled}
          required
        />
      </div>
      <div className="field">
        <label className="field-label">Risk Description</label>
        <textarea
          className="input"
          value={values.description}
          onChange={(e) => onChange('description', e.target.value)}
          disabled={disabled}
          required
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field-label">Category</label>
          <select className="select-input" value={values.categoryId} onChange={(e) => onChange('categoryId', e.target.value)} disabled={disabled} required>
            <option value="">Select…</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
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
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field-label">Owner</label>
          <select className="select-input" value={values.ownerId} onChange={(e) => onChange('ownerId', e.target.value)} disabled={disabled} required>
            <option value="">Select…</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Status</label>
          <select className="select-input" value={values.status} onChange={(e) => onChange('status', e.target.value as RiskStatus)} disabled={disabled}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {RISK_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field-label">Likelihood (1–5)</label>
          <select
            className="select-input"
            value={values.likelihood}
            onChange={(e) => onChange('likelihood', Number(e.target.value))}
            disabled={disabled}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} — {SCALE_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Impact (1–5)</label>
          <select className="select-input" value={values.impact} onChange={(e) => onChange('impact', Number(e.target.value))} disabled={disabled}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} — {SCALE_LABELS[n]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field-label">Treatment</label>
          <select
            className="select-input"
            value={values.treatmentStrategy}
            onChange={(e) => onChange('treatmentStrategy', e.target.value as TreatmentStrategy | '')}
            disabled={disabled}
          >
            <option value="">None yet…</option>
            {TREATMENT_STRATEGIES.map((s) => (
              <option key={s} value={s}>
                {s[0] + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Residual Score (after treatment)</label>
          <input
            className="input"
            style={{ fontFamily: 'var(--font-chrome)', fontWeight: 'bold' }}
            type="number"
            min={1}
            max={25}
            value={values.residualScore}
            onChange={(e) => onChange('residualScore', e.target.value === '' ? '' : Number(e.target.value))}
            disabled={disabled}
          />
          <div className="helper-note">
            Entered manually by the risk owner — the band color updates automatically. Will become a computed value once the
            Control Library and BIA are in place.
          </div>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field-label">Treatment Note</label>
          <input
            className="input"
            style={{ fontFamily: 'var(--font-chrome)' }}
            value={values.treatmentNote}
            onChange={(e) => onChange('treatmentNote', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="field">
          <label className="field-label">Next Review Date</label>
          <input
            className="input"
            style={{ fontFamily: 'var(--font-chrome)' }}
            type="date"
            value={values.nextReviewDate}
            onChange={(e) => onChange('nextReviewDate', e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label className="field-label">Notes</label>
        <textarea className="input" value={values.notes} onChange={(e) => onChange('notes', e.target.value)} disabled={disabled} />
      </div>
    </>
  );
}
