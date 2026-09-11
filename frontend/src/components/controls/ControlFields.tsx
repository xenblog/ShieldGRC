import { Category, ControlFrequency, ControlType, Framework, NistCsfFunction, OrgUnit } from '@/lib/types';
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
  frameworkIds: string[];
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
    frameworkIds: [],
  };
}

export function ControlFields({
  values,
  onChange,
  categories,
  orgUnits,
  frameworks,
  disabled,
}: {
  values: ControlFieldValues;
  onChange: <K extends keyof ControlFieldValues>(key: K, value: ControlFieldValues[K]) => void;
  categories: Category[] | null;
  orgUnits: OrgUnit[] | null;
  frameworks: Framework[] | null;
  disabled?: boolean;
}) {
  function toggleFramework(id: string) {
    onChange('frameworkIds', values.frameworkIds.includes(id) ? values.frameworkIds.filter((f) => f !== id) : [...values.frameworkIds, id]);
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
        <label className="field-label">Frameworks</label>
        {frameworks && frameworks.length > 0 ? (
          <div className="modal-list" style={{ maxHeight: 160 }}>
            {frameworks.map((f) => {
              const checked = values.frameworkIds.includes(f.id);
              return (
                <div key={f.id} className="modal-list-row" onClick={() => !disabled && toggleFramework(f.id)}>
                  <div className={`modal-checkbox${checked ? ' checked' : ''}`}>
                    {checked && (
                      <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                  <span className="modal-row-title">{f.name}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="helper-note">No frameworks defined yet.</p>
        )}
      </div>
    </>
  );
}
