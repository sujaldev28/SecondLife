'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, Moon, Sun, X, ArrowUpRight } from 'lucide-react';
import { useAuth } from './AuthContext';
import { BrandLogo } from './BrandLogo';
import { useTheme } from './ThemeContext';

export function Navbar() {
  const pathname = usePathname();
  const { user, permissions } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const dashboardHref = permissions.includes('admin:overview')
    ? '/dashboard/admin'
    : user?.primaryRole === 'buyer'
      ? '/dashboard/buyer'
      : '/dashboard/owner';

  const links = [
    { href: '/explore', label: 'Explore Assets' },
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/for-owners', label: 'For Owners' },
    { href: '/for-buyers', label: 'For Buyers' },
    { href: '/enterprise', label: 'Enterprise' },
    { href: '/pricing', label: 'Pricing' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-token bg-[var(--bg)]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0">
          <BrandLogo subtitle="Intelligent Digital Revival" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#8B5CF6]/12 text-[#8B5CF6]'
                    : 'text-secondary-token hover:bg-surface-elevated hover:text-primary-token'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2.5 lg:flex">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-token bg-surface-elevated text-secondary-token transition hover:text-primary-token cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-[#FBBF24]" /> : <Moon className="h-4 w-4 text-[#6366F1]" />}
          </button>

          {user ? (
            <Link
              href={dashboardHref}
              className="sl-gradient-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition"
            >
              Open Console
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-secondary-token transition hover:bg-surface-elevated hover:text-primary-token"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="sl-gradient-primary rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle color theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-token bg-surface-elevated text-secondary-token"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-[#FBBF24]" /> : <Moon className="h-4 w-4 text-[#6366F1]" />}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-token bg-surface-elevated p-2 text-secondary-token"
            aria-label="Toggle Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-token bg-elevated px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-1.5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-secondary-token hover:bg-surface-elevated hover:text-primary-token"
              >
                {l.label}
              </Link>
            ))}
            <hr className="my-2 border-token" />
            {user ? (
              <Link
                href={dashboardHref}
                onClick={() => setOpen(false)}
                className="sl-gradient-primary rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Open Console
              </Link>
            ) : (
              <div className="flex gap-2">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-lg border border-token bg-surface px-3 py-2 text-center text-sm font-medium text-primary-token"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="sl-gradient-primary flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
