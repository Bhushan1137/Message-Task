'use client';

import React from 'react';
import { WebhookEvent } from '../types';
import { StatusBadge } from './StatusBadge';
import { ResultBadge } from './ResultBadge';
import { formatDate } from '../lib/utils';
import { X, Hash, Calendar } from 'lucide-react';

interface EventDetailModalProps {
  event: WebhookEvent | null;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-900 text-lg">Webhook Event Details</h3>
            <ResultBadge result={event.processingResult} />
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200/70">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Hash className="w-3.5 h-3.5" /> Event ID
              </p>
              <p className="font-mono text-xs text-slate-800 break-all mt-1">{event.eventId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Hash className="w-3.5 h-3.5" /> Message ID
              </p>
              <p className="font-mono text-xs text-slate-800 break-all mt-1">{event.messageId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Incoming Status
              </p>
              <StatusBadge status={event.status} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Processing Result
              </p>
              <ResultBadge result={event.processingResult} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-600 flex items-center gap-1.5 text-xs font-medium">
                <Calendar className="w-4 h-4 text-slate-400" /> Occurred At (Provider)
              </span>
              <span className="font-medium text-slate-900 text-xs">{formatDate(event.occurredAt)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-600 flex items-center gap-1.5 text-xs font-medium">
                <Calendar className="w-4 h-4 text-slate-400" /> Received At
              </span>
              <span className="font-medium text-slate-900 text-xs">{formatDate(event.receivedAt)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-slate-600 flex items-center gap-1.5 text-xs font-medium">
                <Calendar className="w-4 h-4 text-slate-400" /> Processed At
              </span>
              <span className="font-medium text-slate-900 text-xs">{formatDate(event.processedAt)}</span>
            </div>
          </div>

          {/* Raw payload representation */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Original Payload Data
            </p>
            <pre className="bg-slate-900 text-slate-100 p-3.5 rounded-lg text-xs font-mono overflow-x-auto">
              {JSON.stringify(
                {
                  eventId: event.eventId,
                  messageId: event.messageId,
                  status: event.status,
                  occurredAt: event.occurredAt,
                },
                null,
                2
              )}
            </pre>
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
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
