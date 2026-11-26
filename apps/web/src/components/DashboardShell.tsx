'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Bookmark,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Compass,
  FileCheck,
  FolderGit2,
  Gavel,
  HelpCircle,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  PlusCircle,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Store,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { BrandLogo } from './BrandLogo';
import { useTheme } from './ThemeContext';
import { apiFetch, formatLabel } from '@/lib/api';

type ConsoleMode = 'owner' | 'buyer' | 'admin';

interface NavGroup {
  label: string;
  items: Array<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }>;
}

const OWNER_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/dashboard/owner', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/owner/assets', label: 'My Assets', icon: FolderGit2 },
      { href: '/dashboard/owner/submit', label: 'Submit Asset', icon: PlusCircle },
      { href: '/dashboard/owner/analysis', label: 'Analysis', icon: Activity },
      { href: '/dashboard/owner/listings', label: 'Marketplace', icon: Store },
    ],
  },
  {
    label: 'Commercialization',
    items: [
      { href: '/dashboard/owner/verification', label: 'Verification', icon: FileCheck },
      { href: '/dashboard/owner/inquiries', label: 'Inquiries', icon: MessageSquare },
      { href: '/dashboard/owner/deals', label: 'Deals', icon: Briefcase },
      { href: '/dashboard/owner/transactions', label: 'Transactions', icon: Wallet },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/dashboard/owner/reports', label: 'Reports', icon: BarChart3 },
      { href: '/dashboard/owner/settings', label: 'Team & Settings', icon: Settings },
    ],
  },
];

const BUYER_GROUPS: NavGroup[] = [
  {
    label: 'Discovery',
    items: [
      { href: '/dashboard/buyer', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/buyer/discover', label: 'Marketplace', icon: Search },
      { href: '/dashboard/buyer/saved', label: 'Saved Assets', icon: Bookmark },
    ],
  },
  {
    label: 'Commercialization',
    items: [
      { href: '/dashboard/buyer/requirements', label: 'Buyer Requirements', icon: ClipboardList },
      { href: '/dashboard/buyer/recommendations', label: 'Matches', icon: Sparkles },
      { href: '/dashboard/buyer/inquiries', label: 'Inquiries', icon: MessageSquare },
      { href: '/dashboard/buyer/negotiations', label: 'Negotiations', icon: Compass },
      { href: '/dashboard/buyer/deals', label: 'Deals', icon: Briefcase },
      { href: '/dashboard/buyer/transactions', label: 'Transactions', icon: Wallet },
    ],
  },
  {
    label: 'Management',
    items: [{ href: '/dashboard/buyer/settings', label: 'Settings', icon: Settings }],
  },
];

const ADMIN_GROUPS: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { href: '/dashboard/admin', label: 'Overview', icon: LayoutDashboard },
      { href: '/dashboard/admin/verification', label: 'Verification', icon: FileCheck },
      { href: '/dashboard/admin/disputes', label: 'Disputes', icon: Gavel },
      { href: '/dashboard/admin/marketplace', label: 'Marketplace', icon: Store },
    ],
  },
  {
    label: 'Entities & Revenue',
    items: [
      { href: '/dashboard/admin/users', label: 'Users', icon: Users },
      { href: '/dashboard/admin/organizations', label: 'Organizations', icon: Building2 },
      { href: '/dashboard/admin/assets', label: 'Assets', icon: FolderGit2 },
      { href: '/dashboard/admin/deals', label: 'Deals', icon: Briefcase },
      { href: '/dashboard/admin/transactions', label: 'Transactions', icon: Wallet },
    ],
  },
  {
    label: 'Intelligence & Governance',
    items: [
      { href: '/dashboard/admin/analytics', label: 'Analytics & AI', icon: BarChart3 },
      { href: '/dashboard/admin/security', label: 'Security & Audit', icon: Lock },
      { href: '/dashboard/admin/settings', label: 'System Settings', icon: Settings },
    ],
  },
];

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

export function DashboardShell({
  mode,
  title,
  subtitle,
  children,
}: {
  mode: ConsoleMode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, organizations, activeOrganizationId, switchOrganization, logout, permissions } =
    useAuth();
  const { theme, toggleTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ notifications: NotificationItem[] }>('/notifications')
      .then((d) => setNotifications(d.notifications))
      .catch(() => {});
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app">
        <div className="flex flex-col items-center gap-3">
          <BrandLogo compact />
          <div className="text-xs font-medium text-secondary-token">Loading SecondLife workspace...</div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const groups = mode === 'owner' ? OWNER_GROUPS : mode === 'buyer' ? BUYER_GROUPS : ADMIN_GROUPS;
  const canAdmin = permissions.includes('admin:overview') || permissions.includes('verification:review');
  const activeOrg = organizations.find((o) => o.organizationId === activeOrganizationId);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const breadcrumbs = pathname
    .split('/')
    .filter(Boolean)
    .slice(1)
    .map((seg) => (seg.length > 20 ? 'Workspace' : formatLabel(seg)));

  const markRead = async (id: string) => {
    await apiFetch(`/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  };

  const sidebarContent = (isCompact: boolean) => (
    <div className="flex h-full flex-col bg-elevated border-r border-token">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-token px-4 py-3.5">
        <Link href="/" className="overflow-hidden">
          <BrandLogo
            compact={isCompact}
            subtitle={
              mode === 'owner'
                ? 'Owner Console'
                : mode === 'buyer'
                  ? 'Buyer Console'
                  : 'Admin Governance'
            }
          />
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="hidden h-7 w-7 items-center justify-center rounded-md border border-token bg-surface text-muted-token hover:text-primary-token lg:flex cursor-pointer"
          aria-label="Toggle sidebar"
        >
          {isCompact ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Organization & Mode Switcher */}
      {!isCompact && (
        <div className="border-b border-token px-4 py-3">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-token">
            Organization
          </label>
          <select
            value={activeOrganizationId || ''}
            onChange={(e) => switchOrganization(e.target.value)}
            className="sl-input mt-1.5 w-full rounded-lg px-2.5 py-1.5 text-xs font-medium"
          >
            {organizations.map((org) => (
              <option key={org.organizationId} value={org.organizationId}>
                {org.organizationName}
              </option>
            ))}
          </select>

          <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg border border-token bg-app p-1 text-[11px]">
            <Link
              href="/dashboard/owner"
              className={`rounded-md py-1 text-center font-semibold transition ${
                mode === 'owner'
                  ? 'sl-gradient-primary text-white shadow-xs'
                  : 'text-secondary-token hover:text-primary-token'
              }`}
            >
              Owner
            </Link>
            <Link
              href="/dashboard/buyer"
              className={`rounded-md py-1 text-center font-semibold transition ${
                mode === 'buyer'
                  ? 'sl-gradient-primary text-white shadow-xs'
                  : 'text-secondary-token hover:text-primary-token'
              }`}
            >
              Buyer
            </Link>
            {canAdmin ? (
              <Link
                href="/dashboard/admin"
                className={`rounded-md py-1 text-center font-semibold transition ${
                  mode === 'admin'
                    ? 'sl-gradient-primary text-white shadow-xs'
                    : 'text-secondary-token hover:text-primary-token'
                }`}
              >
                Admin
              </Link>
            ) : (
              <Link
                href="/explore"
                className="rounded-md py-1 text-center font-semibold text-secondary-token hover:text-primary-token"
              >
                Market
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Navigation Groups */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label}>
            {!isCompact && (
              <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-token">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={isCompact ? item.label : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-all ${
                      active
                        ? 'bg-gradient-to-r from-[#8B5CF6]/20 to-[#6366F1]/10 text-primary-token border border-[#8B5CF6]/35'
                        : 'text-secondary-token hover:bg-surface-elevated hover:text-primary-token border border-transparent'
                    } ${isCompact ? 'justify-center' : ''}`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        active ? 'text-[#22D3EE]' : 'text-muted-token group-hover:text-primary-token'
                      }`}
                    />
                    {!isCompact && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Profile + Support */}
      <div className="border-t border-token p-3">
        {!isCompact ? (
          <div className="rounded-xl border border-token bg-surface p-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#22D3EE] text-xs font-bold text-white">
                {user.fullName
                  .split(' ')
                  .map((p) => p[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-primary-token">{user.fullName}</div>
                <div className="truncate text-[10px] text-muted-token">{formatLabel(user.primaryRole)}</div>
              </div>
            </div>
            <div className="mt-2.5 flex gap-1.5">
              <Link
                href="/faq"
                className="flex flex-1 items-center justify-center gap-1 rounded-md border border-token bg-app py-1.5 text-[11px] font-medium text-secondary-token hover:text-primary-token"
              >
                <HelpCircle className="h-3 w-3" />
                Help
              </Link>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  router.push('/login');
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-md border border-token bg-app py-1.5 text-[11px] font-medium text-secondary-token hover:text-[#FB7185] cursor-pointer"
              >
                <LogOut className="h-3 w-3" />
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.push('/login');
            }}
            title="Sign Out"
            className="flex w-full items-center justify-center rounded-lg border border-token bg-surface p-2 text-secondary-token hover:text-[#FB7185] cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-app text-primary-token">
      {/* Desktop Sidebar */}
      <aside className={`hidden shrink-0 transition-all duration-200 lg:block ${collapsed ? 'w-[72px]' : 'w-64'}`}>
        <div className="sticky top-0 h-screen">{sidebarContent(collapsed)}</div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-64">{sidebarContent(false)}</div>
          <div
            className="flex-1 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact Top Navigation Header */}
        <header className="sticky top-0 z-30 border-b border-token bg-[var(--bg)]/85 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-lg border border-token bg-surface p-2 text-secondary-token lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="hidden items-center gap-1.5 text-xs text-muted-token sm:flex">
                {breadcrumbs.map((b, i) => (
                  <React.Fragment key={`${b}-${i}`}>
                    {i > 0 && <span>/</span>}
                    <span className={i === breadcrumbs.length - 1 ? 'font-semibold text-primary-token' : ''}>
                      {b}
                    </span>
                  </React.Fragment>
                ))}
              </div>
              {activeOrg && (
                <span className="hidden rounded-full border border-token bg-surface px-2.5 py-0.5 text-[11px] font-medium text-secondary-token md:inline-flex">
                  {activeOrg.organizationName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (globalSearch.trim()) {
                    router.push(`/explore?q=${encodeURIComponent(globalSearch.trim())}`);
                  }
                }}
                className="relative hidden md:block"
              >
                <Search className="absolute top-2 left-2.5 h-3.5 w-3.5 text-muted-token" />
                <input
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search marketplace..."
                  className="sl-input w-48 rounded-lg py-1.5 pr-3 pl-8 text-xs lg:w-60"
                />
              </form>

              <Link
                href={mode === 'buyer' ? '/dashboard/buyer/requirements' : '/dashboard/owner/submit'}
                className="sl-gradient-primary hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white sm:inline-flex"
              >
                <Plus className="h-3.5 w-3.5" />
                {mode === 'buyer' ? 'New Requirement' : 'Submit Asset'}
              </Link>

              {/* Notifications Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen((v) => !v);
                    setHelpOpen(false);
                  }}
                  aria-label="Notifications"
                  className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-token bg-surface text-secondary-token hover:text-primary-token cursor-pointer"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#8B5CF6] text-[10px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="sl-card-elevated absolute right-0 mt-2 w-80 rounded-xl p-3 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-token pb-2">
                      <span className="text-xs font-semibold text-primary-token">Notifications</span>
                      <button type="button" onClick={() => setNotifOpen(false)} className="text-muted-token">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-token">No notifications yet.</p>
                      ) : (
                        notifications.slice(0, 6).map((n) => (
                          <div
                            key={n.id}
                            onClick={() => markRead(n.id)}
                            className={`cursor-pointer rounded-lg border p-2.5 text-xs ${
                              n.isRead
                                ? 'border-token bg-app text-secondary-token'
                                : 'border-[#8B5CF6]/40 bg-[#8B5CF6]/10 text-primary-token'
                            }`}
                          >
                            <div className="font-semibold">{n.title}</div>
                            <div className="mt-0.5 text-[11px] text-secondary-token">{n.body}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Help Popover */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setHelpOpen((v) => !v);
                    setNotifOpen(false);
                  }}
                  aria-label="Help"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-token bg-surface text-secondary-token hover:text-primary-token cursor-pointer"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
                {helpOpen && (
                  <div className="sl-card-elevated absolute right-0 mt-2 w-64 rounded-xl p-3 text-xs shadow-2xl">
                    <div className="font-semibold text-primary-token">SecondLife Support</div>
                    <p className="mt-1 text-secondary-token">
                      Review compliance gates, analysis methodology, and deal room guidelines.
                    </p>
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      <Link href="/how-it-works" className="text-[#22D3EE] hover:underline">
                        How SecondLife Works →
                      </Link>
                      <Link href="/faq" className="text-[#22D3EE] hover:underline">
                        Security &amp; Legal FAQ →
                      </Link>
                      <Link href="/contact" className="text-[#22D3EE] hover:underline">
                        Contact Operations →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle color theme"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-token bg-surface text-secondary-token hover:text-primary-token cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4 text-[#FBBF24]" /> : <Moon className="h-4 w-4 text-[#6366F1]" />}
              </button>
            </div>
          </div>

          {/* Page Title Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-token px-4 py-3.5 sm:px-6">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-primary-token sm:text-xl">{title}</h1>
              {subtitle && <p className="mt-0.5 text-xs text-secondary-token sm:text-sm">{subtitle}</p>}
            </div>
            {!user.emailVerified && (
              <Link
                href="/verify-email"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#FBBF24]/40 bg-[#FBBF24]/12 px-3 py-1.5 text-xs font-semibold text-[#FBBF24]"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                Verify Email
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 animate-sl-in">{children}</main>
      </div>
    </div>
  );
}
