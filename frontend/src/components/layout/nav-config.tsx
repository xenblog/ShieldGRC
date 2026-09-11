import { ReactNode } from 'react';

export interface NavItem {
  label: string;
  href?: string;
  locked?: boolean;
  phase?: string;
  icon: ReactNode;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

const strokeProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ICONS = {
  dashboard: (
    <svg {...strokeProps}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  riskRegister: (
    <svg {...strokeProps}>
      <circle cx="4" cy="6" r="1" />
      <line x1="8" y1="6" x2="21" y2="6" />
      <circle cx="4" cy="12" r="1" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <circle cx="4" cy="18" r="1" />
      <line x1="8" y1="18" x2="21" y2="18" />
    </svg>
  ),
  riskAssessment: (
    <svg {...strokeProps}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 12.5l2 2 4-4.5" />
    </svg>
  ),
  biaRegister: (
    <svg {...strokeProps}>
      <path d="M12 3l7 3.5v5.2c0 4.6-3.1 7.5-7 8.8-3.9-1.3-7-4.2-7-8.8V6.5L12 3z" />
      <line x1="12" y1="8" x2="12" y2="12.5" />
      <circle cx="12" cy="15.3" r="0.9" fill="currentColor" />
    </svg>
  ),
  controlLibrary: (
    <svg {...strokeProps}>
      <rect x="4" y="4" width="6" height="16" rx="1" />
      <rect x="12" y="4" width="4" height="16" rx="1" />
      <rect x="18" y="6" width="2" height="14" rx="1" />
    </svg>
  ),
  controlTesting: (
    <svg {...strokeProps}>
      <path d="M12 3l7 3.5v5.2c0 4.6-3.1 7.5-7 8.8-3.9-1.3-7-4.2-7-8.8V6.5L12 3z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </svg>
  ),
  compliance: (
    <svg {...strokeProps}>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M9 13l2.5 2.5L16 11" />
    </svg>
  ),
  aiGovernance: (
    <svg {...strokeProps}>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  ),
  supplierRisk: (
    <svg {...strokeProps}>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <line x1="12" y1="13" x2="12" y2="21" />
    </svg>
  ),
  auditLog: (
    <svg {...strokeProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  ),
  users: (
    <svg {...strokeProps}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c1.2-3.8 4.2-6 7-6s5.8 2.2 7 6" />
    </svg>
  ),
  settings: (
    <svg {...strokeProps}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="1.6" fill="currentColor" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="1.6" fill="currentColor" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="7" cy="18" r="1.6" fill="currentColor" />
    </svg>
  ),
  logout: (
    <svg {...strokeProps}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', href: '/dashboards', icon: ICONS.dashboard }],
  },
  {
    label: 'Risk Management',
    items: [
      { label: 'Risk Register', href: '/risk-register', icon: ICONS.riskRegister },
      { label: 'Risk Assessment', href: '/risk-assessment/assessments', icon: ICONS.riskAssessment },
      { label: 'BIA Register', href: '/bia-register', icon: ICONS.biaRegister },
    ],
  },
  {
    label: 'Controls',
    items: [
      { label: 'Control Library', href: '/controls', icon: ICONS.controlLibrary },
      { label: 'Control Testing', locked: true, phase: 'Fase 2', icon: ICONS.controlTesting },
    ],
  },
  {
    label: 'Compliance',
    items: [{ label: 'Compliance', locked: true, phase: 'Fase 2', icon: ICONS.compliance }],
  },
  {
    label: 'AI Governance',
    items: [{ label: 'AI Management', locked: true, phase: 'Fase 3', icon: ICONS.aiGovernance }],
  },
  {
    label: 'Supplier Risk',
    items: [{ label: 'Leverandørregister', locked: true, phase: 'Fase 4', icon: ICONS.supplierRisk }],
  },
];

/**
 * Admin-only, rendered under the "System" section label - matches the
 * mockup's System group exactly: Users, Audit Log, Settings. Org Units and
 * Categories are no longer top-level nav items - they're small list-editors
 * under Settings (see /admin/settings), not their own Risk Register-style
 * sections.
 */
export const SYSTEM_NAV_ITEMS: NavItem[] = [
  { label: 'Users', href: '/admin/users', icon: ICONS.users },
  { label: 'Audit Log', href: '/admin/audit-log', icon: ICONS.auditLog },
  { label: 'Settings', href: '/admin/settings', icon: ICONS.settings },
];
