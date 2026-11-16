'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import { StatusBadge } from '../../components/StatusBadge';
import { CreateMessageModal } from '../../components/CreateMessageModal';
import { MessageDetailModal } from '../../components/MessageDetailModal';
import { Message, MessageStatus } from '../../types';
import { formatDate } from '../../lib/utils';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  Radio,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function MessagesPage() {
  const { currentTenantId } = useTenant();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MessageStatus | ''>('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['messages', currentTenantId, { search, status: statusFilter }],
    queryFn: () =>
      api.getMessages({
        search: search || undefined,
        status: (statusFilter as MessageStatus) || undefined,
        limit: 50,
      }),
  });

  const statuses: Array<{ value: MessageStatus | ''; label: string }> = [
    { value: '', label: 'All Statuses' },
    { value: 'QUEUED', label: 'Queued' },
    { value: 'SENT', label: 'Sent' },
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'READ', label: 'Read' },
    { value: 'FAILED', label: 'Failed' },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Messages</h2>
          <p className="text-sm text-slate-500">
            Inspect outgoing dispatch queue & state transitions for{' '}
            <span className="font-semibold text-slate-800 uppercase">{currentTenantId}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Create Message
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by recipient phone, conversation ID, or message text..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          />
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:block" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MessageStatus | '')}
            className="w-full md:w-44 px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/70 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Recipient</th>
                <th className="px-5 py-3.5">Conversation ID</th>
                <th className="px-5 py-3.5">Message Text</th>
                <th className="px-5 py-3.5">Created At</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                    Loading messages...
                  </td>
                </tr>
              ) : !data?.messages || data.messages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No messages match the current filters.
                  </td>
                </tr>
              ) : (
                data.messages.map((msg) => (
                  <tr
                    key={msg.id}
                    className="hover:bg-slate-50/70 transition cursor-pointer"
                    onClick={() => setSelectedMessage(msg)}
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <StatusBadge status={msg.status} />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap font-medium text-slate-900">
                      {msg.to}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {msg.conversationId}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs truncate text-slate-600">
                      {msg.text}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-slate-500">
                      {formatDate(msg.createdAt)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedMessage(msg)}
                          title="View Details"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/simulator?messageId=${msg.id}`)}
                          title="Simulate Webhook"
                          className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-md transition"
                        >
                          <Radio className="w-4 h-4" />
                        </button>
                      </div>
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
            Showing {data?.messages?.length || 0} messages
          </span>
          <span className="font-mono text-[11px]">
            Tenant: {currentTenantId}
          </span>
        </div>
      </div>

      <CreateMessageModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <MessageDetailModal message={selectedMessage} onClose={() => setSelectedMessage(null)} />
    </>
  );
}
