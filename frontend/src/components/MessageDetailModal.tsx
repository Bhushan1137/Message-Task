'use client';

import React from 'react';
import { Message } from '../types';
import { StatusBadge } from './StatusBadge';
import { formatDate } from '../lib/utils';
import { X, Play, Clock, Phone, Hash, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MessageDetailModalProps {
  message: Message | null;
  onClose: () => void;
}

export function MessageDetailModal({ message, onClose }: MessageDetailModalProps) {
  const router = useRouter();

  if (!message) return null;

  const handleSimulate = () => {
    onClose();
    router.push(`/simulator?messageId=${message.id}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-900 text-lg">Message Details</h3>
            <StatusBadge status={message.status} size="md" />
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200/70 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Hash className="w-3.5 h-3.5" /> Message ID
              </p>
              <p className="font-mono text-xs text-slate-800 break-all mt-1">{message.id}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Hash className="w-3.5 h-3.5" /> Conversation ID
              </p>
              <p className="font-medium text-slate-800 mt-1">{message.conversationId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> Recipient
              </p>
              <p className="font-medium text-slate-800 mt-1">{message.to}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Tenant
              </p>
              <p className="font-medium text-slate-800 mt-1">{message.tenantId}</p>
            </div>
          </div>

          {/* Message Text */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
              <FileText className="w-3.5 h-3.5" /> Text Content
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm text-slate-800 whitespace-pre-wrap">
              {message.text}
            </div>
          </div>

          {/* Timestamps Lifecycle */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Lifecycle Timestamps
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg border border-slate-200 bg-white">
                <p className="text-slate-500 font-medium">Created</p>
                <p className="font-medium text-slate-800 mt-1">{formatDate(message.createdAt)}</p>
              </div>
              <div
                className={`p-2.5 rounded-lg border ${
                  message.sentAt ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <p className="text-slate-500 font-medium">Sent At</p>
                <p className="font-medium text-slate-800 mt-1">{formatDate(message.sentAt)}</p>
              </div>
              <div
                className={`p-2.5 rounded-lg border ${
                  message.deliveredAt
                    ? 'border-indigo-200 bg-indigo-50/50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <p className="text-slate-500 font-medium">Delivered At</p>
                <p className="font-medium text-slate-800 mt-1">{formatDate(message.deliveredAt)}</p>
              </div>
              <div
                className={`p-2.5 rounded-lg border ${
                  message.readAt
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : message.failedAt
                    ? 'border-rose-200 bg-rose-50/50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <p className="text-slate-500 font-medium">
                  {message.failedAt ? 'Failed At' : 'Read At'}
                </p>
                <p className="font-medium text-slate-800 mt-1">
                  {formatDate(message.failedAt || message.readAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={handleSimulate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition"
            >
              <Play className="w-3.5 h-3.5" />
              Simulate Webhook for this Message
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
