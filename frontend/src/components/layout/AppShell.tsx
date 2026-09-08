'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { NAV_ITEMS, ADMIN_NAV_ITEMS, NavItem } from './nav-config';

function NavNode({ item, depth, pathname }: { item: NavItem; depth: number; pathname: string }) {
  const isActive = item.href === pathname;
  const padding = { paddingLeft: `${12 + depth * 12}px` };

  if (item.locked) {
    return (
      <div>
        <div
          style={padding}
          aria-disabled
          title="Coming later"
          className="flex items-center justify-between py-1.5 pr-3 text-sm text-gray-400"
        >
          <span>{item.label}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-400">
            Coming later
          </span>
        </div>
        {item.children?.map((child) => (
          <NavNode key={child.label} item={{ ...child, locked: true }} depth={depth + 1} pathname={pathname} />
        ))}
      </div>
    );
  }

  if (item.href) {
    return (
      <Link
        href={item.href}
        style={padding}
        className={`block py-1.5 pr-3 text-sm ${
          isActive ? 'bg-[var(--dgs-primary)]/10 font-medium text-[var(--dgs-primary)]' : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <div>
      <div style={padding} className="pt-2 pb-1 pr-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
        {item.label}
      </div>
      {item.children?.map((child) => <NavNode key={child.label} item={child} depth={depth + 1} pathname={pathname} />)}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 border-r bg-white" style={{ borderColor: 'var(--dgs-border)' }}>
        <div className="border-b px-4 py-4" style={{ borderColor: 'var(--dgs-border)' }}>
          <p className="text-sm font-bold text-[var(--dgs-primary)]">DagrofaShield</p>
        </div>
        <nav className="py-2">
          {NAV_ITEMS.map((item) => (
            <NavNode key={item.label} item={item} depth={0} pathname={pathname} />
          ))}
          {user?.role === 'ADMIN' && (
            <div>
              <div className="pt-3 pb-1 pl-3 pr-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Admin</div>
              {ADMIN_NAV_ITEMS.map((item) => (
                <NavNode key={item.label} item={item} depth={1} pathname={pathname} />
              ))}
            </div>
          )}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header
          className="flex items-center justify-end gap-3 border-b bg-white px-6 py-3"
          style={{ borderColor: 'var(--dgs-border)' }}
        >
          {user && (
            <>
              <span className="text-sm text-gray-600">
                {user.name} <span className="text-gray-400">({user.role})</span>
              </span>
              <button onClick={() => logout()} className="text-sm text-[var(--dgs-primary)] hover:underline">
                Sign out
              </button>
            </>
          )}
        </header>
        <main className="flex-1 bg-[var(--dgs-bg)] p-6">{children}</main>
      </div>
    </div>
  );
}
