import type { LucideIcon } from 'lucide-react';

import { CARD_CLASS } from '@/components/ui/styles';

interface MetricCardProps {
  label: string;
  value: string;
  helperText?: string;
  icon: LucideIcon;
  accentClass?: string;
}

export function MetricCard({ label, value, helperText, icon: Icon, accentClass = 'text-brand-600' }: MetricCardProps) {
  return (
    <article className={CARD_CLASS}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {helperText && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
        </div>
        <Icon className={`h-8 w-8 ${accentClass}`} />
      </div>
    </article>
  );
}
