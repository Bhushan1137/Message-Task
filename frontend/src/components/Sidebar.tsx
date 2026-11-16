'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Radio,
  FileCode2,
  SendHorizontal,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/conversations', label: 'Conversations', icon: MessagesSquare },
  { href: '/simulator', label: 'Webhook Simulator', icon: Radio },
  { href: '/events', label: 'Event Logs', icon: FileCode2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
      {/* Brand */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
          <SendHorizontal className="w-4 h-4" />
        </div>
        <div>
          <h1 className="font-bold text-slate-900 leading-tight">Messaging</h1>
          <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">
            Multi-Tenant Platform
          </p>
        </div>
      </div>

      {/* Nav list */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="p-4 border-t border-slate-100 text-xs text-slate-400">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold text-slate-600">Simulated Env</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600">
            v1.0.0
          </span>
        </div>
        <p className="text-[11px] leading-relaxed">
          Out-of-order & concurrency protected webhook engine.
        </p>
      </div>
    </aside>
  );
}
