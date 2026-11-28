import { env } from '../config/env.js';

export interface DemoAccountDescriptor {
  fullName: string;
  email: string;
  password: string;
  role: string;
  roleLabel: string;
  description: string;
}

export const DEMO_SAMPLE_PASSWORD = 'Demo@12345';

export const DEMO_ACCOUNTS: readonly DemoAccountDescriptor[] = [
  {
    fullName: 'Alice Morgan',
    email: 'alice@demo.secondlife.test',
    password: DEMO_SAMPLE_PASSWORD,
    role: 'individual_owner',
    roleLabel: 'Individual Asset Owner',
    description: 'Submit and manage personal digital assets, evaluations, and listings.',
  },
  {
    fullName: 'Bob Wilson',
    email: 'bob@demo.secondlife.test',
    password: DEMO_SAMPLE_PASSWORD,
    role: 'buyer',
    roleLabel: 'Buyer',
    description: 'Browse marketplace, save assets, define requirements, and create demo offers.',
  },
  {
    fullName: 'Charlie Brown',
    email: 'charlie@demo.secondlife.test',
    password: DEMO_SAMPLE_PASSWORD,
    role: 'developer',
    roleLabel: 'Developer',
    description: 'Access developer workflows, run evaluations, and collaborate on demo assets.',
  },
  {
    fullName: 'Diana Miller',
    email: 'diana@demo.secondlife.test',
    password: DEMO_SAMPLE_PASSWORD,
    role: 'org_admin',
    roleLabel: 'Organization Admin',
    description: 'Manage Northstar Demo Labs organization, team members, and workspaces.',
  },
  {
    fullName: 'Ethan Taylor',
    email: 'ethan@demo.secondlife.test',
    password: DEMO_SAMPLE_PASSWORD,
    role: 'platform_admin',
    roleLabel: 'Platform Admin',
    description: 'Access platform administration, verification queue, and audit logs in demo mode.',
  },
] as const;

export function isDemoModeEnabled(): boolean {
  if (env.APP_ENV === 'production') {
    return false;
  }
  if (env.NODE_ENV === 'production') {
    return env.DEMO_MODE_ENABLED === true;
  }
  return env.DEMO_MODE_ENABLED !== false;
}

/**
 * Returns demo accounts safe to expose in `/auth/config`.
 * Never exposes any demo accounts in production, and never exposes a public
 * `platform_admin` demo account when `NODE_ENV === 'production'`.
 */
export function getPublicDemoAccounts(): DemoAccountDescriptor[] {
  if (!isDemoModeEnabled()) {
    return [];
  }
  if (env.NODE_ENV === 'production') {
    return DEMO_ACCOUNTS.filter((acc) => acc.role !== 'platform_admin');
  }
  return [...DEMO_ACCOUNTS];
}
