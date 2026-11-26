import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@secondlife/shared'],
  env: {
    NEXT_PUBLIC_VERCEL: process.env.VERCEL ?? '',
  },
};

export default nextConfig;
