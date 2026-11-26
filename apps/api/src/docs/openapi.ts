export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SecondLife Digital Asset Commercialization API',
    version: '1.0.0',
    description:
      'REST API for SecondLife: Identity/RBAC, Asset Discovery & Lifecycle, Ownership Verification, AI Technical & Commercial Intelligence, Marketplace, Deal Rooms, Transactions, and Platform Governance.',
  },
  servers: [{ url: '/api/v1' }],
  paths: {
    '/auth/register': { post: { summary: 'Register user and initial workspace', tags: ['Auth'] } },
    '/auth/login': { post: { summary: 'Authenticate and issue session tokens', tags: ['Auth'] } },
    '/auth/verify-email': { post: { summary: 'Verify email token', tags: ['Auth'] } },
    '/organizations': {
      get: { summary: 'List user organizations', tags: ['Organizations'] },
      post: { summary: 'Create organization and workspace', tags: ['Organizations'] },
    },
    '/assets': {
      get: { summary: 'List active organization assets', tags: ['Assets'] },
      post: { summary: 'Create digital asset record', tags: ['Assets'] },
    },
    '/assets/{id}/upload-archive': { post: { summary: 'Upload and inspect safe ZIP archive', tags: ['Assets'] } },
    '/assets/{id}/analyze': { post: { summary: 'Run AI technical & commercial evaluation', tags: ['AI Analysis'] } },
    '/assets/{id}/ownership-declaration': { post: { summary: 'Submit ownership declaration & verification', tags: ['Verification'] } },
    '/verification/{requestId}/decision': { post: { summary: 'Approve or reject verification request', tags: ['Verification'] } },
    '/marketplace/listings': { get: { summary: 'Search published marketplace listings', tags: ['Marketplace'] } },
    '/inquiries': { post: { summary: 'Submit buyer inquiry on listing', tags: ['Deals'] } },
    '/deals/{id}/offers': { post: { summary: 'Submit or counter offer in deal room', tags: ['Deals'] } },
    '/deals/{id}/transactions/initiate': { post: { summary: 'Initiate payment & commission calculation', tags: ['Transactions'] } },
    '/payments/webhooks/razorpay': { post: { summary: 'Razorpay HMAC-verified webhook handler', tags: ['Transactions'] } },
    '/admin/overview': { get: { summary: 'Platform operational analytics', tags: ['Admin'] } },
  },
};
