// Reserves the exact information architecture from the product spec so the
// full nav is legible even though only Overview and Risk Management are
// functional in this build. `locked` sections (and everything under them)
// render disabled, with no functional route behind them - see
// controls/control-testing/compliance page.tsx (all replaced with a shared
// <LockedSection> placeholder) and ai-governance/supplier-risk (no route at
// all yet, nav-only).
export interface NavItem {
  label: string;
  href?: string;
  locked?: boolean;
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Overview',
    children: [{ label: 'Dashboards', href: '/dashboards' }],
  },
  {
    label: 'Risk Management',
    children: [
      // Risk Register renders the list and heat map as one page (see
      // risk-register/page.tsx), so this is a single link, not a submenu.
      { label: 'Risk Register', href: '/risk-register' },
      {
        label: 'Risk Assessment',
        children: [
          { label: 'Assessments', href: '/risk-assessment/assessments' },
          { label: 'Treatment Actions', href: '/risk-assessment/treatment-actions' },
          { label: 'Assessment Methodology', href: '/risk-assessment/methodology' },
        ],
      },
    ],
  },
  {
    label: 'Controls',
    locked: true,
    children: [
      { label: 'Control Library', href: '/controls' },
      { label: 'Control Testing', href: '/control-testing' },
    ],
  },
  {
    label: 'Compliance',
    locked: true,
    children: [{ label: 'Compliance (Frameworks)', href: '/compliance' }],
  },
  { label: 'AI Governance', locked: true },
  { label: 'Supplier Risk', locked: true },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Users', href: '/admin/users' },
  { label: 'Org Units', href: '/admin/org-units' },
  { label: 'Categories', href: '/admin/categories' },
  { label: 'Audit Log', href: '/admin/audit-log' },
];
