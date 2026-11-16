'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useTenant } from '../context/TenantContext';
import { StatusBadge } from '../components/StatusBadge';
import { ResultBadge } from '../components/ResultBadge';
import { CreateMessageModal } from '../components/CreateMessageModal';
import { MessageDetailModal } from '../components/MessageDetailModal';
import { Message, WebhookEvent } from '../types';
import { formatDate, formatRelativeTime } from '../lib/utils';
import {
  MessageSquare,
  Clock,
  Send,
  Check,
  CheckCheck,
  AlertOctagon,
  Plus,
  ArrowRight,
  Radio,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { currentTenantId } = useTenant();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['dashboard-stats', currentTenantId],
    queryFn: () => api.getDashboardStats(),
  });

  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['messages', currentTenantId, { limit: 5 }],
    queryFn: () => api.getMessages({ limit: 5 }),
  });

  const {
    data: recentEvents,
    isLoading: eventsLoading,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ['recent-webhook-activity', currentTenantId],
    queryFn: () => api.getRecentWebhookActivity(),
  });

  const handleRefresh = () => {
    refetchStats();
    refetchMessages();
    refetchEvents();
  };

  const statCards = [
    {
      title: 'Total Messages',
      value: stats?.total ?? 0,
      icon: MessageSquare,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    },
    {
      title: 'Queued',
      value: stats?.queued ?? 0,
      icon: Clock,
      color: 'text-amber-600 bg-amber-50 border-amber-100',
    },
    {
      title: 'Sent',
      value: stats?.sent ?? 0,
      icon: Send,
      color: 'text-sky-600 bg-sky-50 border-sky-100',
    },
    {
      title: 'Delivered',
      value: stats?.delivered ?? 0,
      icon: Check,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    },
    {
      title: 'Read',
      value: stats?.read ?? 0,
      icon: CheckCheck,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    },
    {
      title: 'Failed',
      value: stats?.failed ?? 0,
      icon: AlertOctagon,
      color: 'text-rose-600 bg-rose-50 border-rose-100',
    },
  ];

  const total = stats?.total || 1;
  const queuedPct = Math.round(((stats?.queued || 0) / total) * 100);
  const sentPct = Math.round(((stats?.sent || 0) / total) * 100);
  const deliveredPct = Math.round(((stats?.delivered || 0) / total) * 100);
  const readPct = Math.round(((stats?.read || 0) / total) * 100);
  const failedPct = Math.round(((stats?.failed || 0) / total) * 100);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Platform Overview</h2>
          <p className="text-sm text-slate-600 mt-1">
            Real-time delivery analytics & message lifecycle monitoring for{' '}
            <span className="font-semibold text-slate-900 uppercase">{currentTenantId}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-500">{card.title}</span>
                <div className={`p-1.5 rounded-lg border ${card.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 tracking-tight">
                {statsLoading ? '—' : card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Status Distribution Progress */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Delivery Status Distribution</h3>
          <span className="text-xs text-slate-400 font-medium">
            {stats?.total ?? 0} total messages
          </span>
        </div>
        {stats && stats.total > 0 ? (
          <>
            <div className="h-2.5 w-full bg-slate-100 rounded-full flex overflow-hidden">
              {stats.queued > 0 && (
                <div style={{ width: `${queuedPct}%` }} className="bg-amber-400" title={`Queued: ${stats.queued}`} />
              )}
              {stats.sent > 0 && (
                <div style={{ width: `${sentPct}%` }} className="bg-sky-500" title={`Sent: ${stats.sent}`} />
              )}
              {stats.delivered > 0 && (
                <div style={{ width: `${deliveredPct}%` }} className="bg-indigo-500" title={`Delivered: ${stats.delivered}`} />
              )}
              {stats.read > 0 && (
                <div style={{ width: `${readPct}%` }} className="bg-emerald-500" title={`Read: ${stats.read}`} />
              )}
              {stats.failed > 0 && (
                <div style={{ width: `${failedPct}%` }} className="bg-rose-500" title={`Failed: ${stats.failed}`} />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                Queued ({stats.queued})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                Sent ({stats.sent})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                Delivered ({stats.delivered})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Read ({stats.read})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Failed ({stats.failed})
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400 py-1">No messages dispatched for this tenant yet.</p>
        )}
      </div>

      {/* Two Column Layout: Recent Messages & Recent Webhook Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Messages */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-500" />
              Recent Messages
            </h3>
            <Link
              href="/messages"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {messagesLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading messages...</div>
            ) : !messagesData?.messages || messagesData.messages.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No messages yet. Click "Create Message" above to send one.
              </div>
            ) : (
              messagesData.messages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => setSelectedMessage(msg)}
                  className="p-4 hover:bg-slate-50/80 transition cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900 text-sm truncate">{msg.to}</span>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                        {msg.conversationId}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1">{msg.text}</p>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {formatRelativeTime(msg.createdAt)}
                    </span>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <StatusBadge status={msg.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Webhook Activity */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
            <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-slate-500" />
              Recent Webhook Activity
            </h3>
            <Link
              href="/events"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
            >
              View event logs <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {eventsLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading activity...</div>
            ) : !recentEvents || recentEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No webhook events received yet. Try the Webhook Simulator!
              </div>
            ) : (
              recentEvents.map((evt) => (
                <div key={evt.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-medium text-slate-800">{evt.eventId}</span>
                      <ResultBadge result={evt.processingResult} />
                    </div>
                    <p className="text-slate-500 truncate">
                      Msg: <span className="font-mono">{evt.messageId.substring(0, 8)}...</span> ({evt.message?.to || '—'})
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      {formatRelativeTime(evt.receivedAt)}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={evt.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <CreateMessageModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <MessageDetailModal message={selectedMessage} onClose={() => setSelectedMessage(null)} />
    </>
  );
}
