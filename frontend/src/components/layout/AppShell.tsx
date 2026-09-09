'use client';

import { useEffect, useRef, useState } from 'react';
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
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
  }

  return (
    <div className="app" style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <aside className="sidebar" ref={menuRef}>
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

        {menuOpen && (
          <div className="logout-menu">
            {/* Not yet a functional destination in this build (only Overview,
                Risk Management, and System are) - closes the menu rather
                than navigating into a page that doesn't exist yet. */}
            <button type="button" className="logout-menu-item" onClick={() => setMenuOpen(false)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.2" />
                <path d="M5 20c1.2-3.8 4.2-6 7-6s5.8 2.2 7 6" />
              </svg>
              Min profil
            </button>
            <div className="logout-menu-divider" />
            <button type="button" className="logout-menu-item danger" onClick={handleLogout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log ud
            </button>
            <div className="logout-menu-caret" />
          </div>
        )}

        {user && (
          <button type="button" className="user-card" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="true" aria-expanded={menuOpen}>
            <div className="avatar">{initials(user.name)}</div>
            <div>
              <div className="user-name">{user.name}</div>
              <div className="user-role">{user.role ? (ROLE_LABEL[user.role] ?? user.role) : 'Pending setup'}</div>
            </div>
          </button>
        )}
      </aside>

      <div className="main" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
