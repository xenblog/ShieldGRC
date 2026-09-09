'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { NAV_SECTIONS, SYSTEM_NAV_ITEMS, NavItem } from './nav-config';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrator',
  RISK_OWNER: 'Risk Owner',
  AUDITOR: 'Auditor',
  EXECUTIVE: 'Executive Viewer',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

function NavRow({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = !!item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`));

  if (item.locked || !item.href) {
    return (
      <div className="nav-item locked">
        {item.icon}
        <span>{item.label}</span>
        {item.phase && <span className="nav-tag">{item.phase}</span>}
      </div>
    );
  }

  return (
    <Link href={item.href} className={`nav-item${isActive ? ' active' : ''}`}>
      {item.icon}
      <span>{item.label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  return (
    <div className="app" style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" />
          <div className="brand-name">DagrofaShield</div>
        </div>

        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {section.items.map((item) => (
              <NavRow key={item.label} item={item} pathname={pathname} />
            ))}
          </div>
        ))}

        {user?.role === 'ADMIN' && (
          <div>
            <div className="nav-section-label">System</div>
            {SYSTEM_NAV_ITEMS.map((item) => (
              <NavRow key={item.label} item={item} pathname={pathname} />
            ))}
          </div>
        )}

        <div style={{ flexGrow: 1 }} />

        {user && (
          <div className="user-card">
            <div className="avatar">{initials(user.name)}</div>
            <div>
              <div className="user-name">{user.name}</div>
              <div className="user-role">{ROLE_LABEL[user.role] ?? user.role}</div>
            </div>
          </div>
        )}
      </aside>

      <div className="main" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
