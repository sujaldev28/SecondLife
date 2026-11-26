export const ROLES = [
  'individual_owner',
  'org_owner',
  'org_admin',
  'asset_owner',
  'buyer',
  'developer',
  'evaluator',
  'verification_specialist',
  'deal_manager',
  'enterprise_member',
  'platform_admin',
  'super_admin',
] as const;

export type RoleName = (typeof ROLES)[number];

export const PERMISSIONS = [
  // Assets & Ingestion
  'asset:create',
  'asset:read_own',
  'asset:update_own',
  'asset:delete_own',
  'asset:submit',
  'asset:publish',
  'asset:archive',
  'discovery:run',
  'discovery:read',

  // AI & Technical / Commercial Analysis
  'analysis:trigger',
  'analysis:read_own',
  'analysis:read_public',
  'analysis:read_confidential',
  'analysis:override',

  // Ownership, Verification & Compliance
  'verification:submit',
  'verification:read_own',
  'verification:review',
  'verification:approve',
  'verification:dispute_file',
  'verification:dispute_resolve',

  // Marketplace & Buyer Discovery
  'marketplace:browse',
  'marketplace:save',
  'marketplace:compare',
  'marketplace:inquire',
  'marketplace:moderate',
  'requirements:manage',

  // Deals, Messaging & Transactions
  'deal:create',
  'deal:read_participant',
  'deal:negotiate',
  'deal:manage_all',
  'agreement:create',
  'agreement:sign',
  'transaction:initiate',
  'transaction:read_own',
  'transaction:refund',
  'handover:deliver',
  'handover:confirm',

  // Organization & Workspace
  'org:create',
  'org:read',
  'org:manage',
  'org:invite',
  'org:audit_read',
  'workspace:manage',
  'subscription:manage',

  // Platform Administration & Governance
  'admin:overview',
  'admin:users',
  'admin:orgs',
  'admin:assets',
  'admin:transactions',
  'admin:analytics',
  'admin:settings',
  'admin:security',
  'admin:ai_monitor',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const OWNER_BASE_PERMISSIONS: Permission[] = [
  'asset:create',
  'asset:read_own',
  'asset:update_own',
  'asset:delete_own',
  'asset:submit',
  'asset:publish',
  'asset:archive',
  'discovery:run',
  'discovery:read',
  'analysis:trigger',
  'analysis:read_own',
  'analysis:read_public',
  'verification:submit',
  'verification:read_own',
  'verification:dispute_file',
  'marketplace:browse',
  'marketplace:save',
  'marketplace:compare',
  'deal:read_participant',
  'deal:negotiate',
  'agreement:create',
  'agreement:sign',
  'transaction:read_own',
  'handover:deliver',
  'org:create',
  'org:read',
  'subscription:manage',
];

const BUYER_BASE_PERMISSIONS: Permission[] = [
  'marketplace:browse',
  'marketplace:save',
  'marketplace:compare',
  'marketplace:inquire',
  'requirements:manage',
  'analysis:read_public',
  'verification:dispute_file',
  'deal:create',
  'deal:read_participant',
  'deal:negotiate',
  'agreement:sign',
  'transaction:initiate',
  'transaction:read_own',
  'handover:confirm',
  'org:create',
  'org:read',
  'subscription:manage',
];

export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  individual_owner: [...OWNER_BASE_PERMISSIONS],
  asset_owner: [...OWNER_BASE_PERMISSIONS],
  buyer: [...BUYER_BASE_PERMISSIONS],
  enterprise_member: Array.from(
    new Set([
      ...OWNER_BASE_PERMISSIONS,
      ...BUYER_BASE_PERMISSIONS,
      'analysis:read_confidential',
    ]),
  ),
  org_admin: Array.from(
    new Set([
      ...OWNER_BASE_PERMISSIONS,
      ...BUYER_BASE_PERMISSIONS,
      'org:manage',
      'org:invite',
      'org:audit_read',
      'workspace:manage',
    ]),
  ),
  org_owner: Array.from(
    new Set([
      ...OWNER_BASE_PERMISSIONS,
      ...BUYER_BASE_PERMISSIONS,
      'org:manage',
      'org:invite',
      'org:audit_read',
      'workspace:manage',
      'subscription:manage',
    ]),
  ),
  developer: [
    'asset:create',
    'asset:read_own',
    'asset:update_own',
    'discovery:read',
    'analysis:trigger',
    'analysis:read_own',
    'analysis:read_public',
    'marketplace:browse',
    'marketplace:save',
    'marketplace:compare',
    'deal:read_participant',
    'org:read',
  ],
  evaluator: [
    'marketplace:browse',
    'analysis:trigger',
    'analysis:read_public',
    'analysis:read_confidential',
    'analysis:override',
    'discovery:read',
    'admin:ai_monitor',
  ],
  verification_specialist: [
    'marketplace:browse',
    'analysis:read_public',
    'analysis:read_confidential',
    'verification:review',
    'verification:approve',
    'verification:dispute_resolve',
    'admin:assets',
  ],
  deal_manager: [
    'marketplace:browse',
    'deal:read_participant',
    'deal:negotiate',
    'deal:manage_all',
    'agreement:create',
    'transaction:read_own',
    'admin:transactions',
  ],
  platform_admin: [
    'marketplace:browse',
    'marketplace:moderate',
    'analysis:read_public',
    'analysis:read_confidential',
    'analysis:override',
    'verification:review',
    'verification:approve',
    'verification:dispute_resolve',
    'deal:manage_all',
    'transaction:refund',
    'admin:overview',
    'admin:users',
    'admin:orgs',
    'admin:assets',
    'admin:transactions',
    'admin:analytics',
    'admin:settings',
    'admin:security',
    'admin:ai_monitor',
  ],
  super_admin: [...PERMISSIONS],
};

export function resolvePermissions(
  roles: readonly string[],
  extraPermissions: readonly string[] = [],
): Set<Permission> {
  const granted = new Set<Permission>();
  for (const role of roles) {
    const mapped = ROLE_PERMISSIONS[role as RoleName];
    if (mapped) {
      for (const perm of mapped) {
        granted.add(perm);
      }
    }
  }
  for (const perm of extraPermissions) {
    if ((PERMISSIONS as readonly string[]).includes(perm)) {
      granted.add(perm as Permission);
    }
  }
  return granted;
}

export function hasPermission(
  roles: readonly string[],
  required: Permission | readonly Permission[],
  extraPermissions: readonly string[] = [],
): boolean {
  const granted = resolvePermissions(roles, extraPermissions);
  const reqList = Array.isArray(required) ? required : [required];
  return reqList.every((p) => granted.has(p));
}
