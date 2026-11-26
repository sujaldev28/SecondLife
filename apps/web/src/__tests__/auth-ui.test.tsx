// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/login',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/Navbar', () => ({
  Navbar: () => <nav data-testid="navbar" />,
}));

vi.mock('@/components/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    refreshUser: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/components/ToastContext', () => ({
  useToast: () => ({ pushToast: vi.fn() }),
}));

import LoginPage from '../app/login/page';
import RegisterPage from '../app/register/page';

const DEMO_ACCOUNTS_FIXTURE = [
  {
    fullName: 'Alice Morgan',
    email: 'alice@demo.secondlife.test',
    password: 'Demo@12345',
    role: 'individual_owner',
    roleLabel: 'Individual Asset Owner',
    description: 'Owner',
  },
  {
    fullName: 'Bob Wilson',
    email: 'bob@demo.secondlife.test',
    password: 'Demo@12345',
    role: 'buyer',
    roleLabel: 'Buyer',
    description: 'Buyer',
  },
  {
    fullName: 'Charlie Brown',
    email: 'charlie@demo.secondlife.test',
    password: 'Demo@12345',
    role: 'developer',
    roleLabel: 'Developer',
    description: 'Developer',
  },
  {
    fullName: 'Diana Miller',
    email: 'diana@demo.secondlife.test',
    password: 'Demo@12345',
    role: 'org_admin',
    roleLabel: 'Organization Admin',
    description: 'Org Admin',
  },
  {
    fullName: 'Ethan Taylor',
    email: 'ethan@demo.secondlife.test',
    password: 'Demo@12345',
    role: 'platform_admin',
    roleLabel: 'Platform Admin',
    description: 'Platform Admin',
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushMock.mockReset();
});

describe('Sign In Page Demo Credentials & Authentication', () => {
  it('displays all 5 demo credentials when demo mode is enabled, populates fields on click, and signs in via backend API', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const target = String(url);
      if (target.endsWith('/auth/config')) {
        return new Response(
          JSON.stringify({
            demoModeEnabled: true,
            googleOAuthEnabled: false,
            demoAccounts: DEMO_ACCOUNTS_FIXTURE,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (target.endsWith('/auth/login')) {
        const body = JSON.parse(String(init?.body || '{}'));
        return new Response(
          JSON.stringify({
            accessToken: 'jwt-token',
            refreshToken: 'refresh-token',
            user: { primaryRole: 'platform_admin', fullName: 'Ethan Taylor', email: body.email },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<LoginPage />);

    // Verify all 5 demo accounts are visible
    for (const acc of DEMO_ACCOUNTS_FIXTURE) {
      await screen.findByText(acc.fullName);
      expect(screen.getByText(acc.email)).toBeTruthy();
      expect(screen.getByText(acc.roleLabel)).toBeTruthy();
    }

    const emailInput = screen.getByPlaceholderText('you@company.com') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;

    // Selecting each account populates email & password without auto-submitting
    for (const acc of DEMO_ACCOUNTS_FIXTURE) {
      fireEvent.click(screen.getByText(acc.fullName));
      expect(emailInput.value).toBe(acc.email);
      expect(passwordInput.value).toBe('Demo@12345');
    }

    // Normal Sign In button authenticates selected account (Ethan Taylor) through backend API
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }));

    await waitFor(() => {
      const loginCall = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/auth/login'));
      expect(loginCall).toBeTruthy();
      const sent = JSON.parse(String(loginCall![1]?.body));
      expect(sent.email).toBe('ethan@demo.secondlife.test');
      expect(sent.password).toBe('Demo@12345');
    });
  });

  it('hides demo credentials completely when demo mode is disabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ demoModeEnabled: false, googleOAuthEnabled: false, demoAccounts: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    render(<LoginPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Demo Credentials/i)).toBeNull();
      expect(screen.queryByText('alice@demo.secondlife.test')).toBeNull();
    });
  });
});

describe('Register Page Confirm Password Validation', () => {
  it('blocks registration when password and confirm password do not match', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<RegisterPage />);

    const inputs = Array.from(document.querySelectorAll('input'));
    // Full Name, Email, Password, Confirm Password
    fireEvent.change(inputs[0], { target: { value: 'Test User' } });
    fireEvent.change(inputs[1], { target: { value: 'testuser@example.com' } });
    fireEvent.change(inputs[2], { target: { value: 'StrongPassword@123' } });
    fireEvent.change(inputs[3], { target: { value: 'DifferentPassword@123' } });

    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(await screen.findByText('Passwords do not match')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
