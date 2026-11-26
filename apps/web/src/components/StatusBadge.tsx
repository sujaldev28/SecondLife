import { formatLabel } from '@/lib/api';

const TONE_MAP: Record<string, string> = {
  published: 'bg-[#34D399]/12 text-[#34D399] border-[#34D399]/30',
  verified: 'bg-[#34D399]/12 text-[#34D399] border-[#34D399]/30',
  approved: 'bg-[#34D399]/12 text-[#34D399] border-[#34D399]/30',
  completed: 'bg-[#34D399]/12 text-[#34D399] border-[#34D399]/30',
  settled: 'bg-[#34D399]/12 text-[#34D399] border-[#34D399]/30',
  captured: 'bg-[#34D399]/12 text-[#34D399] border-[#34D399]/30',
  active: 'bg-[#34D399]/12 text-[#34D399] border-[#34D399]/30',
  accepted: 'bg-[#34D399]/12 text-[#34D399] border-[#34D399]/30',
  executed: 'bg-[#34D399]/12 text-[#34D399] border-[#34D399]/30',
  licensed: 'bg-[#22D3EE]/12 text-[#22D3EE] border-[#22D3EE]/30',
  transferred: 'bg-[#22D3EE]/12 text-[#22D3EE] border-[#22D3EE]/30',
  under_analysis: 'bg-[#22D3EE]/12 text-[#22D3EE] border-[#22D3EE]/30',
  handover_pending: 'bg-[#60A5FA]/12 text-[#60A5FA] border-[#60A5FA]/30',
  negotiation: 'bg-[#8B5CF6]/15 text-[#A78BFA] border-[#8B5CF6]/35',
  agreement_pending: 'bg-[#6366F1]/15 text-[#818CF8] border-[#6366F1]/35',
  under_review: 'bg-[#FBBF24]/12 text-[#FBBF24] border-[#FBBF24]/30',
  pending: 'bg-[#FBBF24]/12 text-[#FBBF24] border-[#FBBF24]/30',
  pending_review: 'bg-[#FBBF24]/12 text-[#FBBF24] border-[#FBBF24]/30',
  pending_signatures: 'bg-[#FBBF24]/12 text-[#FBBF24] border-[#FBBF24]/30',
  verification_required: 'bg-[#FBBF24]/12 text-[#FBBF24] border-[#FBBF24]/30',
  payment_pending: 'bg-[#FBBF24]/12 text-[#FBBF24] border-[#FBBF24]/30',
  open: 'bg-[#FBBF24]/12 text-[#FBBF24] border-[#FBBF24]/30',
  medium: 'bg-[#FBBF24]/12 text-[#FBBF24] border-[#FBBF24]/30',
  rejected: 'bg-[#FB7185]/12 text-[#FB7185] border-[#FB7185]/30',
  suspended: 'bg-[#FB7185]/12 text-[#FB7185] border-[#FB7185]/30',
  failed: 'bg-[#FB7185]/12 text-[#FB7185] border-[#FB7185]/30',
  critical: 'bg-[#FB7185]/15 text-[#FB7185] border-[#FB7185]/40',
  high: 'bg-[#FB7185]/12 text-[#FB7185] border-[#FB7185]/30',
  low: 'bg-[#60A5FA]/12 text-[#60A5FA] border-[#60A5FA]/30',
  draft: 'bg-surface-elevated text-secondary-token border-token',
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status || 'draft').toLowerCase();
  const cls = TONE_MAP[key] || 'bg-surface-elevated text-secondary-token border-token';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {formatLabel(status)}
    </span>
  );
}
