'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import { StatusBadge } from '../../components/StatusBadge';
import { ResultBadge } from '../../components/ResultBadge';
import { EventDetailModal } from '../../components/EventDetailModal';
import { WebhookEvent, ProcessingResult } from '../../types';
import { formatDate } from '../../lib/utils';
import {
  Search,
  Filter,
  RefreshCw,
  FileCode2,
  Eye,
  Radio,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function EventLogsPage() {
  const { currentTenantId } = useTenant();
  const router = useRouter();

  const [messageIdFilter, setMessageIdFilter] = useState('');
  const [resultFilter, setResultFilter] = useState<ProcessingResult | ''>('');
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      'webhook-events',
      currentTenantId,
      { messageId: messageIdFilter, processingResult: resultFilter },
    ],
    queryFn: () =>
      api.getWebhookEvents({
        messageId: messageIdFilter.trim() || undefined,
        processingResult: (resultFilter as ProcessingResult) || undefined,
        limit: 50,
      }),
  });

  const results: Array<{ value: ProcessingResult | ''; label: string }> = [
    { value: '', label: 'All Results' },
    { value: 'APPLIED', label: 'APPLIED' },
    { value: 'IGNORED', label: 'IGNORED' },
    { value: 'DUPLICATE', label: 'DUPLICATE' },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Webhook Event Logs</h2>
          <p className="text-sm text-slate-600 mt-1">
            Immutable audit trail of all incoming provider webhook events for{' '}
            <span className="font-semibold text-slate-900 uppercase">{currentTenantId}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => router.push('/simulator')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
          >
            <Radio className="w-4 h-4" />
            Open Simulator
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
        {/* Search by Message ID */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={messageIdFilter}
            onChange={(e) => setMessageIdFilter(e.target.value)}
            placeholder="Filter by Message UUID..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
          />
        </div>

        {/* Processing Result Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-500 shrink-0 hidden sm:block" />
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value as ProcessingResult | '')}
            className="w-full md:w-44 px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
          >
            {results.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Event Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Result</th>
                <th className="px-5 py-3.5">Event ID</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Message ID</th>
                <th className="px-5 py-3.5">Occurred At</th>
                <th className="px-5 py-3.5">Received At</th>
                <th className="px-5 py-3.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">
                    Loading webhook event logs...
                  </td>
                </tr>
              ) : !data?.events || data.events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">
                    <FileCode2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No webhook events recorded for current filters.
                  </td>
                </tr>
              ) : (
                data.events.map((evt) => (
                  <tr
                    key={evt.id}
                    className="hover:bg-slate-50/70 transition cursor-pointer"
                    onClick={() => setSelectedEvent(evt)}
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <ResultBadge result={evt.processingResult} />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs font-medium text-slate-900">
                      {evt.eventId}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <StatusBadge status={evt.status} />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs text-slate-600">
                      {evt.messageId.substring(0, 8)}...
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500">
                      {formatDate(evt.occurredAt)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500">
                      {formatDate(evt.receivedAt)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(evt);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {data?.events?.length || 0} events
          </span>
          <span className="font-mono text-[11px]">
            Tenant isolation active ({currentTenantId})
          </span>
        </div>
      </div>

      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </>
  );
}
