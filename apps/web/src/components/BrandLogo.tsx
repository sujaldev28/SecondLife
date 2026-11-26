import React from 'react';

export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brand-a" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="55%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id="brand-b" x1="56" y1="16" x2="12" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="#0E1220" stroke="#283149" strokeWidth="2" />
      <path d="M46 21A18 18 0 0 0 15.5 22.5" stroke="url(#brand-a)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M18 43A18 18 0 0 0 48.5 41.5" stroke="url(#brand-b)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M44 13L48 22L38.5 22.5" stroke="#22D3EE" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 51L16 42L25.5 41.5" stroke="#34D399" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="26" y="26" width="12" height="12" rx="3.2" transform="rotate(45 32 32)" fill="url(#brand-a)" />
    </svg>
  );
}

export function BrandLogo({
  compact = false,
  subtitle = 'Asset Intelligence',
}: {
  compact?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark className="h-9 w-9 shrink-0" />
      {!compact && (
        <div className="leading-tight">
          <span className="block text-base font-bold tracking-tight text-primary-token">
            Second<span className="text-[#8B5CF6]">Life</span>
          </span>
          <span className="block text-[10px] font-medium tracking-wide uppercase text-muted-token">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}
