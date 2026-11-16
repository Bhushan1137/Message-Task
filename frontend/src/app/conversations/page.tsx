'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import { StatusBadge } from '../../components/StatusBadge';
import { CreateMessageModal } from '../../components/CreateMessageModal';
import { MessageDetailModal } from '../../components/MessageDetailModal';
import { Message, ConversationSummary } from '../../types';
import { formatDate, formatRelativeTime } from '../../lib/utils';
import {
  Search,
  MessagesSquare,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Calendar,
  Phone,
  ChevronRight,
  Radio,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ConversationsPage() {
  const { currentTenantId } = useTenant();
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  // Fetch list of conversations
  const {
    data: convData,
    isLoading: convsLoading,
    refetch: refetchConvs,
  } = useQuery({
    queryKey: ['conversations', currentTenantId, { search }],
    queryFn: async () => {
      const res = await api.getConversations({ search: search || undefined, limit: 50 });
      return res;
    },
  });

  // Automatically select first conversation if none selected
  const conversations = convData?.conversations || [];
  const activeConvId = selectedConversationId || (conversations.length > 0 ? conversations[0].conversationId : null);

  // Fetch messages for active conversation
  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useQuery({
    queryKey: ['conversation-messages', currentTenantId, activeConvId],
    queryFn: () => (activeConvId ? api.getConversationMessages(activeConvId, { limit: 100 }) : null),
    enabled: !!activeConvId,
  });

  const activeMessages = messagesData?.messages || [];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Conversations</h2>
          <p className="text-sm text-slate-600 mt-1">
            Chronological thread history & recipient interactions for{' '}
            <span className="font-semibold text-slate-900 uppercase">{currentTenantId}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetchConvs();
              refetchMessages();
            }}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            New Conversation
          </button>
        </div>
      </div>

      {/* Main 2-column Container */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
        {/* Left Column: Conversation Thread List */}
        <div className="md:col-span-4 border-r border-slate-200 flex flex-col bg-slate-50/30">
          <div className="p-3.5 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter threads..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {convsLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading threads...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <MessagesSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No conversation threads found.
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = activeConvId === conv.conversationId;
                return (
                  <button
                    key={conv.conversationId}
                    onClick={() => setSelectedConversationId(conv.conversationId)}
                    className={`w-full text-left p-3.5 transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                        : 'hover:bg-slate-100/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-slate-900 text-sm font-mono truncate">
                          {conv.conversationId}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {formatRelativeTime(conv.lastMessageAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {conv.messageCount} message{conv.messageCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Message History Timeline */}
        <div className="md:col-span-8 flex flex-col bg-white">
          {activeConvId ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs font-mono">
                    #
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm font-mono">
                      {activeConvId}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {activeMessages.length} message{activeMessages.length !== 1 ? 's' : ''} in thread
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send to this Thread
                </button>
              </div>

              {/* Messages Chronological Stream */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messagesLoading ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loading messages...</div>
                ) : activeMessages.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No messages in this conversation.
                  </div>
                ) : (
                  activeMessages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedMessage(msg)}
                      className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition cursor-pointer bg-white group"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 text-sm flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {msg.to}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {msg.id.substring(0, 8)}...
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={msg.status} />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/simulator?messageId=${msg.id}`);
                            }}
                            title="Simulate Webhook"
                            className="opacity-0 group-hover:opacity-100 p-1 text-indigo-600 hover:bg-indigo-50 rounded transition"
                          >
                            <Radio className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-sm text-slate-700 whitespace-pre-wrap mb-3 leading-relaxed">
                        {msg.text}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 border-t border-slate-100 pt-2">
                        <span>Created: {formatDate(msg.createdAt)}</span>
                        {msg.sentAt && <span className="text-sky-600 font-medium">Sent: {formatDate(msg.sentAt)}</span>}
                        {msg.deliveredAt && <span className="text-indigo-600 font-medium">Delivered: {formatDate(msg.deliveredAt)}</span>}
                        {msg.readAt && <span className="text-emerald-600 font-medium">Read: {formatDate(msg.readAt)}</span>}
                        {msg.failedAt && <span className="text-rose-600 font-medium">Failed: {formatDate(msg.failedAt)}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 text-sm">
              <MessagesSquare className="w-12 h-12 text-slate-300 mb-3" />
              Select a conversation thread to inspect its message history.
            </div>
          )}
        </div>
      </div>

      <CreateMessageModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        defaultConversationId={activeConvId || undefined}
      />
      <MessageDetailModal message={selectedMessage} onClose={() => setSelectedMessage(null)} />
    </>
  );
}
