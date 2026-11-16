'use client';

import React from 'react';
import { MessageStatus } from '../types';
import { Clock, Send, CheckCheck, Check, AlertOctagon } from 'lucide-react';

interface StatusBadgeProps {
  status: MessageStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = {
    QUEUED: {
      label: 'Queued',
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: Clock,
    },
    SENT: {
      label: 'Sent',
      bg: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: Send,
    },
    DELIVERED: {
      label: 'Delivered',
      bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: Check,
    },
    READ: {
      label: 'Read',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCheck,
    },
    FAILED: {
      label: 'Failed',
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: AlertOctagon,
    },
  }[status] || {
    label: status,
    bg: 'bg-slate-50 text-slate-700 border-slate-200',
    icon: Clock,
  };

  const Icon = config.icon;
  const paddingClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${config.bg} ${paddingClass}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {config.label}
    </span>
  );
}
