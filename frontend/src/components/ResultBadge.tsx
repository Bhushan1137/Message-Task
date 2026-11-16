'use client';

import React from 'react';
import { ProcessingResult } from '../types';
import { CheckCircle2, MinusCircle, Copy } from 'lucide-react';

interface ResultBadgeProps {
  result: ProcessingResult;
}

export function ResultBadge({ result }: ResultBadgeProps) {
  const config = {
    APPLIED: {
      label: 'Applied',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
    },
    IGNORED: {
      label: 'Ignored',
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: MinusCircle,
    },
    DUPLICATE: {
      label: 'Duplicate',
      bg: 'bg-slate-100 text-slate-700 border-slate-300',
      icon: Copy,
    },
  }[result] || {
    label: result,
    bg: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: CheckCircle2,
  };

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md border ${config.bg}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
