'use client';

import React, { useState } from 'react';
import { useTenant } from '../context/TenantContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Plus, Building2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { CreateMessageModal } from './CreateMessageModal';

export function Topbar() {
  const { currentTenantId, setTenantId, availableTenants } = useTenant();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: health, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.getHealth(),
    refetchInterval: 15000,
  });

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Tenant:
            </span>
            <div className="relative">
              <select
                value={currentTenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-semibold py-1.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
              >
                {availableTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.id})
                  </option>
                ))}
              </select>
              <Building2 className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Current tenant indicator */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Header <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-mono text-[11px]">x-tenant-id: {currentTenantId}</code> attached
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Health indicator */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isError || health?.status !== 'ok'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
            title="Backend and Database Health Check"
          >
            {isError || health?.status !== 'ok' ? (
              <>
                <AlertTriangle className="w-3 h-3 text-rose-600" />
                <span className="hidden md:inline">DB Disconnected</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span className="hidden md:inline">API & DB Healthy</span>
              </>
            )}
          </div>

          {/* New message button */}
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Message</span>
          </button>
        </div>
      </header>

      <CreateMessageModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </>
  );
}
