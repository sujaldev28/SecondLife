'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export function Button({
  variant = 'primary',
  loading = false,
  className = '',
  children,
  disabled,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] disabled:cursor-not-allowed disabled:opacity-55 cursor-pointer';
  const styles: Record<ButtonVariant, string> = {
    primary: 'sl-gradient-primary text-white shadow-sm hover:shadow-[0_0_24px_-6px_rgba(139,92,246,0.65)]',
    secondary:
      'border border-token bg-surface-elevated text-primary-token hover:bg-[var(--surface-hover)]',
    ghost: 'text-secondary-token hover:bg-[var(--surface-elevated)] hover:text-primary-token',
    destructive:
      'border border-[#FB7185]/35 bg-[#FB7185]/15 text-[#FB7185] hover:bg-[#FB7185]/25',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${styles[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function SurfaceCard({
  className = '',
  elevated = false,
  children,
}: {
  className?: string;
  elevated?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl transition-colors ${
        elevated ? 'sl-card-elevated' : 'sl-card'
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  accent = 'violet',
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'violet' | 'cyan' | 'emerald' | 'amber' | 'indigo' | 'magenta';
  icon?: React.ReactNode;
}) {
  const barColors: Record<string, string> = {
    violet: 'from-[#8B5CF6] to-[#6366F1]',
    cyan: 'from-[#22D3EE] to-[#60A5FA]',
    emerald: 'from-[#34D399] to-[#22D3EE]',
    amber: 'from-[#FBBF24] to-[#FB7185]',
    indigo: 'from-[#6366F1] to-[#22D3EE]',
    magenta: 'from-[#8B5CF6] to-[#E879F9]',
  };
  const iconColors: Record<string, string> = {
    violet: 'text-[#8B5CF6] bg-[#8B5CF6]/12 border-[#8B5CF6]/25',
    cyan: 'text-[#22D3EE] bg-[#22D3EE]/12 border-[#22D3EE]/25',
    emerald: 'text-[#34D399] bg-[#34D399]/12 border-[#34D399]/25',
    amber: 'text-[#FBBF24] bg-[#FBBF24]/12 border-[#FBBF24]/25',
    indigo: 'text-[#6366F1] bg-[#6366F1]/12 border-[#6366F1]/25',
    magenta: 'text-[#E879F9] bg-[#E879F9]/12 border-[#E879F9]/25',
  };

  return (
    <div className="sl-card group relative overflow-hidden rounded-2xl p-5 transition-all hover:border-[#6366F1]/50">
      <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${barColors[accent]}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-muted-token">{label}</div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-primary-token tabular-nums">
            {value}
          </div>
          {hint && <div className="mt-1 text-xs text-secondary-token">{hint}</div>}
        </div>
        {icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${iconColors[accent]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

export function ScoreRing({
  score,
  label,
  size = 84,
  color = '#22D3EE',
}: {
  score: number;
  label: string;
  size?: number;
  color?: string;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circ - (clamped / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="var(--border)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="none"
            className="transition-all duration-700"
          />
        </svg>
        <span className="absolute text-base font-bold text-primary-token tabular-nums">
          {clamped}
        </span>
      </div>
      <span className="mt-2 text-xs font-medium text-secondary-token">{label}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="sl-card flex flex-col items-center justify-center rounded-2xl border-dashed px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#6366F1]/30 bg-[#6366F1]/10 text-[#8B5CF6]">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-primary-token">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-secondary-token">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SkeletonCard({ className = 'h-32' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl border border-token bg-surface ${className}`} />;
}
