import { Category, ControlFrequency, ControlType, FrameworkControl, NistCsfFunction, OrgUnit } from '@/lib/types';
import { CONTROL_FREQUENCY_LABEL, CONTROL_TYPE_LABEL } from '@/lib/status-labels';

const TYPES: ControlType[] = ['PREVENTIVE', 'DETECTIVE', 'CORRECTIVE', 'COMPENSATING'];
const FREQUENCIES: ControlFrequency[] = ['CONTINUOUS', 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];
const NIST_FUNCTIONS: NistCsfFunction[] = ['GOVERN', 'IDENTIFY', 'PROTECT', 'DETECT', 'RESPOND', 'RECOVER'];

export interface ControlFieldValues {
  code: string;
  name: string;
  domainCategoryId: string;
  orgUnitId: string;
  type: ControlType;
  frequency: ControlFrequency;
  nistCsfFunction: NistCsfFunction | '';
  frameworkControlIds: string[];
}

export function emptyControlFieldValues(): ControlFieldValues {
  return {
    code: '',
    name: '',
    domainCategoryId: '',
    orgUnitId: '',
    type: 'PREVENTIVE',
    frequency: 'ANNUAL',
    nistCsfFunction: '',
    frameworkControlIds: [],
  };
}

export function ControlFields({
  values,
  onChange,
  categories,
  orgUnits,
  frameworkControls,
  disabled,
}: {
  values: ControlFieldValues;
  onChange: <K extends keyof ControlFieldValues>(key: K, value: ControlFieldValues[K]) => void;
  categories: Category[] | null;
  orgUnits: OrgUnit[] | null;
  frameworkControls: FrameworkControl[] | null;
  disabled?: boolean;
}) {
  function toggleFrameworkControl(id: string) {
    onChange(
      'frameworkControlIds',
      values.frameworkControlIds.includes(id) ? values.frameworkControlIds.filter((f) => f !== id) : [...values.frameworkControlIds, id],
    );
  }

  const clausesByFramework: { framework: { id: string; name: string }; clauses: FrameworkControl[] }[] = [];
  for (const fc of frameworkControls ?? []) {
    let group = clausesByFramework.find((g) => g.framework.id === fc.framework.id);
    if (!group) {
      group = { framework: fc.framework, clauses: [] };
      clausesByFramework.push(group);
    }
    group.clauses.push(fc);
  }

  return (
    <>
      <div className="field-row">
        <div className="field">
          <label className="field-label">Code</label>
          <input
            className="input"
            style={{ fontFamily: 'var(--font-chrome)' }}
            value={values.code}
            onChange={(e) => onChange('code', e.target.value)}
            disabled={disabled}
            required
          />
        </div>
        <div className="field">
          <label className="field-label">Name</label>
          <input className="input" value={values.name} onChange={(e) => onChange('name', e.target.value)} disabled={disabled} required />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="field-label">Domain (Category)</label>
          <select className="select-input" value={values.domainCategoryId} onChange={(e) => onChange('domainCategoryId', e.target.value)} disabled={disabled} required>
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
          <label className="field-label">Type</label>
          <select className="select-input" value={values.type} onChange={(e) => onChange('type', e.target.value as ControlType)} disabled={disabled}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTROL_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label">Test Frequency</label>
          <select className="select-input" value={values.frequency} onChange={(e) => onChange('frequency', e.target.value as ControlFrequency)} disabled={disabled}>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {CONTROL_FREQUENCY_LABEL[f]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="field-label">NIST CSF Function (optional)</label>
        <select className="select-input" value={values.nistCsfFunction} onChange={(e) => onChange('nistCsfFunction', e.target.value as NistCsfFunction | '')} disabled={disabled}>
          <option value="">None</option>
          {NIST_FUNCTIONS.map((f) => (
            <option key={f} value={f}>
              {f[0] + f.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label className="field-label">Framework Clauses (e.g. ISO 27001 A.5.1)</label>
        {clausesByFramework.length > 0 ? (
          <div className="modal-list" style={{ maxHeight: 220 }}>
            {clausesByFramework.map((group) => (
              <div key={group.framework.id}>
                <div className="helper-note" style={{ margin: '6px 0 2px 8px', fontFamily: 'var(--font-chrome)' }}>
                  {group.framework.name}
                </div>
                {group.clauses.map((fc) => {
                  const checked = values.frameworkControlIds.includes(fc.id);
                  return (
                    <div key={fc.id} className="modal-list-row" onClick={() => !disabled && toggleFrameworkControl(fc.id)}>
                      <div className={`modal-checkbox${checked ? ' checked' : ''}`}>
                        {checked && (
                          <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </div>
                      <span className="modal-row-title">
                        {fc.code} — {fc.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <p className="helper-note">No framework clauses defined yet.</p>
        )}
      </div>
    </>
  );
}
