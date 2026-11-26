import { z } from 'zod';
import { ASSET_TYPES, LISTING_TYPES } from './lifecycle.js';
import { ROLES } from './roles.js';

export const registerSchema = z
  .object({
    email: z.string().trim().email('Please provide a valid email address').max(255),
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .max(128)
      .regex(/[A-Z]/, 'Password must include an uppercase letter')
      .regex(/[a-z]/, 'Password must include a lowercase letter')
      .regex(/[0-9]/, 'Password must include a number')
      .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character'),
    confirmPassword: z.string().optional(),
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
    accountType: z.enum(['individual', 'organization']).default('individual'),
    role: z.enum(['individual_owner', 'asset_owner', 'buyer', 'developer', 'org_owner']).default('individual_owner'),
    organizationName: z.string().trim().min(2).max(120).optional(),
  })
  .refine((data) => data.confirmPassword === undefined || data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain lowercase letters, numbers, or hyphens')
    .optional(),
  orgType: z.enum(['startup', 'enterprise', 'research', 'studio', 'individual']).default('startup'),
  website: z.string().trim().url().optional().or(z.literal('')),
  description: z.string().trim().max(1000).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(ROLES).default('enterprise_member'),
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
});

export const createAssetSchema = z.object({
  name: z.string().trim().min(3).max(160),
  description: z.string().trim().min(20).max(5000),
  shortSummary: z.string().trim().min(10).max(300).optional(),
  assetType: z.enum(ASSET_TYPES),
  categorySlug: z.string().trim().min(2).max(80),
  repositoryUrl: z.string().trim().url().optional().or(z.literal('')),
  repositoryProvider: z.enum(['github', 'gitlab', 'bitbucket', 'archive', 'manual']).default('manual'),
  primaryLanguage: z.string().trim().max(60).optional(),
  techStack: z.array(z.string().trim().min(1).max(60)).max(25).default([]),
  declaredLicense: z.string().trim().max(80).default('Proprietary / Unlicensed'),
  versionTag: z.string().trim().min(1).max(40).default('1.0.0'),
  documentationNotes: z.string().trim().max(8000).optional(),
});

export const ownershipDeclarationSchema = z.object({
  claimantType: z.enum(['sole_author', 'corporate_owner', 'authorized_representative', 'co_owner']),
  ownershipPercentage: z.number().int().min(1).max(100).default(100),
  hasThirdPartyCode: z.boolean().default(false),
  thirdPartySummary: z.string().trim().max(2000).optional(),
  contributorsSummary: z.string().trim().max(2000).optional(),
  attestationAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must attest legal authority to commercialize this asset' }),
  }),
  evidenceNotes: z.string().trim().max(3000).optional(),
});

export const createListingSchema = z.object({
  title: z.string().trim().min(5).max(160),
  summary: z.string().trim().min(20).max(1500),
  listingType: z.enum(LISTING_TYPES),
  currency: z.enum(['INR', 'USD']).default('INR'),
  askingPriceMinor: z.number().int().min(0).max(10_000_000_000),
  commercialTerms: z.string().trim().min(10).max(4000),
  exclusivityAvailable: z.boolean().default(false),
  supportIncludedDays: z.number().int().min(0).max(730).default(30),
});

export const buyerRequirementSchema = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(20).max(3000),
  preferredCategories: z.array(z.string().trim()).max(10).default([]),
  requiredTechnologies: z.array(z.string().trim()).max(20).default([]),
  preferredListingTypes: z.array(z.enum(LISTING_TYPES)).max(5).default([]),
  preferredLicenses: z.array(z.string().trim()).max(10).default([]),
  budgetCurrency: z.enum(['INR', 'USD']).default('INR'),
  maxBudgetMinor: z.number().int().min(0).optional(),
  minTechnicalScore: z.number().int().min(0).max(100).default(50),
});

export const createInquirySchema = z.object({
  assetId: z.string().uuid(),
  listingId: z.string().uuid().optional(),
  subject: z.string().trim().min(4).max(160),
  message: z.string().trim().min(10).max(4000),
  intendedUse: z.enum(['license', 'acquisition', 'revival', 'repurposing', 'evaluation']).default('license'),
});

export const createOfferSchema = z.object({
  offerType: z.enum(LISTING_TYPES),
  amountMinor: z.number().int().min(100),
  currency: z.enum(['INR', 'USD']).default('INR'),
  termsSummary: z.string().trim().min(10).max(4000),
  dueDiligenceRequired: z.boolean().default(true),
  supportDays: z.number().int().min(0).max(365).default(30),
});
