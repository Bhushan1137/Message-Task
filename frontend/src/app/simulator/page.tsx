'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../../components/StatusBadge';
import { ResultBadge } from '../../components/ResultBadge';
import { Message, MessageStatus, WebhookPayload, WebhookResponse } from '../../types';
import {
  Radio,
  Send,
  Check,
  CheckCheck,
  AlertOctagon,
  RotateCcw,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle,
  Copy,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function WebhookSimulatorContent() {
  const searchParams = useSearchParams();
  const initialMessageId = searchParams.get('messageId') || '';
  const { currentTenantId } = useTenant();
  const { success, error, info } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [selectedMessageId, setSelectedMessageId] = useState<string>(initialMessageId);
  const [eventId, setEventId] = useState<string>('');
  const [status, setStatus] = useState<'SENT' | 'DELIVERED' | 'READ' | 'FAILED'>('SENT');
  const [occurredAt, setOccurredAt] = useState<string>(new Date().toISOString());

  // Result display states
  const [lastPayload, setLastPayload] = useState<WebhookPayload | null>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [previousEventPayload, setPreviousEventPayload] = useState<WebhookPayload | null>(null);

  // Fetch messages for convenience selector
  const { data: messagesData, refetch: refetchMessages } = useQuery({
    queryKey: ['messages', currentTenantId],
    queryFn: () => api.getMessages({ limit: 50 }),
  });

  // Auto-select first message if available and none selected
  useEffect(() => {
    if (!selectedMessageId && messagesData?.messages && messagesData.messages.length > 0) {
      setSelectedMessageId(messagesData.messages[0].id);
    }
  }, [messagesData, selectedMessageId]);

  // Fetch selected message details to show live current status (only if valid UUID)
  const isValidUuid = UUID_REGEX.test(selectedMessageId);

  const { data: currentMessage, refetch: refetchCurrentMessage } = useQuery({
    queryKey: ['message', currentTenantId, selectedMessageId],
    queryFn: () => (isValidUuid ? api.getMessage(selectedMessageId) : null),
    enabled: isValidUuid,
  });

  // Auto-generate eventId on load
  useEffect(() => {
    if (!eventId) {
      generateNewEventId();
    }
  }, []);

  const generateNewEventId = (prefix = 'evt') => {
    const id = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    setEventId(id);
    return id;
  };

  const handleSelectMessage = (msgId: string) => {
    setSelectedMessageId(msgId);
    generateNewEventId();
    setOccurredAt(new Date().toISOString());
  };

  const webhookMutation = useMutation({
    mutationFn: async (payload: WebhookPayload) => {
      setLastPayload(payload);
      return api.sendWebhookSimulation(payload);
    },
    onSuccess: (result, variables) => {
      setHttpStatus(result.status);
      setLastResponse(result.data);
      setPreviousEventPayload(variables);

      if (result.ok && result.data?.success) {
        const webhookData = result.data.data as WebhookResponse;

        // Invalidate relevant queries so UI stays synced
        queryClient.invalidateQueries({ queryKey: ['message', currentTenantId, variables.messageId] });
        queryClient.invalidateQueries({ queryKey: ['messages', currentTenantId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats', currentTenantId] });
        queryClient.invalidateQueries({ queryKey: ['webhook-events', currentTenantId] });
        queryClient.invalidateQueries({ queryKey: ['recent-webhook-activity', currentTenantId] });
        refetchCurrentMessage();

        if (webhookData.processingResult === 'APPLIED') {
          success('Webhook APPLIED', `Message status updated to ${webhookData.currentStatus}`);
        } else if (webhookData.processingResult === 'IGNORED') {
          info('Webhook IGNORED', webhookData.message);
        } else if (webhookData.processingResult === 'DUPLICATE') {
          info('Webhook DUPLICATE', 'Event ID has already been recorded. No duplicate effect applied.');
        }

        // Generate a new event ID for next action unless replaying
        generateNewEventId();
        setOccurredAt(new Date().toISOString());
      } else {
        // Handle error response (400, 404, 500)
        const errorObj = result.data?.error;
        let errorMessage = errorObj?.message || 'Webhook rejected by server';

        if (errorObj?.details && Array.isArray(errorObj.details) && errorObj.details.length > 0) {
          const detailStr = errorObj.details.map((d: any) => `${d.path}: ${d.message}`).join(', ');
          errorMessage = `${errorMessage} (${detailStr})`;
        }

        error(`HTTP ${result.status} Error`, errorMessage);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Webhook dispatch failed';
      setHttpStatus(500);
      setLastResponse({ success: false, error: { code: 'NETWORK_ERROR', message: msg } });
      error('Network Error', msg);
    },
  });

  const sendEventWithStatus = (newStatus: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED') => {
    if (!selectedMessageId) {
      error('Missing Message ID', 'Please select or enter a Message ID first.');
      return;
    }
    const currentEvtId = eventId || generateNewEventId();
    const payload: WebhookPayload = {
      eventId: currentEvtId,
      messageId: selectedMessageId,
      status: newStatus,
      occurredAt: new Date().toISOString(),
    };
    setStatus(newStatus);
    webhookMutation.mutate(payload);
  };

  const replayPreviousEvent = () => {
    if (!previousEventPayload) {
      info('No Previous Event', 'Fire at least one event first to enable replay.');
      return;
    }
    // Replay with identical eventId to test database duplicate constraint
    setEventId(previousEventPayload.eventId);
    setSelectedMessageId(previousEventPayload.messageId);
    setStatus(previousEventPayload.status);
    setOccurredAt(previousEventPayload.occurredAt);
    webhookMutation.mutate(previousEventPayload);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessageId) {
      error('Missing Message ID', 'Please select or enter a Message ID.');
      return;
    }
    if (!eventId) {
      error('Missing Event ID', 'Please enter or generate an Event ID.');
      return;
    }
    webhookMutation.mutate({
      eventId,
      messageId: selectedMessageId,
      status,
      occurredAt,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Radio className="w-6 h-6 text-indigo-600" />
          Provider Webhook Simulator
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Simulate real incoming HTTP delivery events from messaging providers (WhatsApp, Meta, SMS).
          Tests atomic database transitions, out-of-order resolution, and idempotent duplicate rejection.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Simulation Controls Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* Quick Action Buttons */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Quick Event Actions
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => sendEventWithStatus('SENT')}
                disabled={!selectedMessageId || webhookMutation.isPending}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                Send SENT
              </button>
              <button
                type="button"
                onClick={() => sendEventWithStatus('DELIVERED')}
                disabled={!selectedMessageId || webhookMutation.isPending}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition disabled:opacity-40"
              >
                <Check className="w-3.5 h-3.5" />
                Send DELIVERED
              </button>
              <button
                type="button"
                onClick={() => sendEventWithStatus('READ')}
                disabled={!selectedMessageId || webhookMutation.isPending}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-40"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Send READ
              </button>
              <button
                type="button"
                onClick={() => sendEventWithStatus('FAILED')}
                disabled={!selectedMessageId || webhookMutation.isPending}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition disabled:opacity-40"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                Send FAILED
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">Duplicate Idempotency Test:</span>
              <button
                type="button"
                onClick={replayPreviousEvent}
                disabled={!previousEventPayload || webhookMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Replay Previous Event
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleManualSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-semibold text-slate-900 text-sm border-b border-slate-100 pb-2">
              Webhook Request Configuration
            </h3>

            {/* Target Message Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Select Existing Message ({currentTenantId})
                </label>
                <button
                  type="button"
                  onClick={() => refetchMessages()}
                  className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
              <select
                value={selectedMessageId}
                onChange={(e) => handleSelectMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
              >
                <option value="">— Select an existing message —</option>
                {messagesData?.messages.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id.substring(0, 8)}... | {m.status} | {m.to} | {m.conversationId}
                  </option>
                ))}
              </select>
            </div>

            {/* Raw Message ID Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Target Message ID (UUID)
                </label>
                {selectedMessageId && (
                  <span
                    className={`text-[11px] font-medium ${
                      isValidUuid ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {isValidUuid ? '✓ Valid UUID format' : '⚠️ Non-UUID string'}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={selectedMessageId}
                onChange={(e) => setSelectedMessageId(e.target.value)}
                placeholder="00000000-0000-0000-0000-000000000000"
                className={`w-full font-mono text-xs px-3 py-2 rounded-lg border bg-white text-slate-900 focus:outline-none focus:ring-2 transition shadow-sm ${
                  selectedMessageId && !isValidUuid
                    ? 'border-amber-400 focus:ring-amber-500/20 focus:border-amber-500'
                    : 'border-slate-300 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />
              {selectedMessageId && !isValidUuid && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Note: Backend requires a valid 36-character UUID. Non-UUID strings will return HTTP 400 (Validation Error).
                </p>
              )}
            </div>

            {/* Event ID with Generate Button */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Event ID (Unique Constraint)
                </label>
                <button
                  type="button"
                  onClick={() => generateNewEventId()}
                  className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                >
                  <Sparkles className="w-3 h-3" /> Generate New ID
                </button>
              </div>
              <input
                type="text"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                placeholder="evt-001"
                className="w-full font-mono text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
              />
            </div>

            {/* Status & Occurred At */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Incoming Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
                >
                  <option value="SENT">SENT</option>
                  <option value="DELIVERED">DELIVERED</option>
                  <option value="READ">READ</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Occurred At (ISO Date)
                  </label>
                  <button
                    type="button"
                    onClick={() => setOccurredAt(new Date().toISOString())}
                    className="text-[11px] text-slate-500 hover:text-slate-700 font-medium"
                  >
                    Set to Now
                  </button>
                </div>
                <input
                  type="text"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="w-full font-mono text-xs px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-sm"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={webhookMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {webhookMutation.isPending ? 'Dispatching Webhook...' : 'Dispatch Webhook to POST /api/v1/webhooks/provider'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Message State & HTTP Response Inspection */}
        <div className="lg:col-span-5 space-y-6">
          {/* Target Message Live Status Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-semibold text-slate-900 text-sm">Target Message State</h3>
              {currentMessage && <StatusBadge status={currentMessage.status} size="md" />}
            </div>

            {currentMessage ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Recipient:</span>
                  <span className="font-medium text-slate-800">{currentMessage.to}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Conversation:</span>
                  <span className="font-mono text-slate-800">{currentMessage.conversationId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Status:</span>
                  <span className="font-bold text-slate-900">{currentMessage.status}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200/60 font-mono text-[11px] text-slate-700 truncate">
                  "{currentMessage.text}"
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 py-2">
                {selectedMessageId && !isValidUuid
                  ? 'Non-UUID entered. Message cannot be looked up in PostgreSQL.'
                  : 'Select or enter a valid Message ID on the left to observe state changes.'}
              </p>
            )}
          </div>

          {/* Outgoing JSON Payload */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Outgoing JSON Request</span>
              <span className="font-mono text-slate-500 text-[10px]">POST /api/v1/webhooks/provider</span>
            </div>
            <pre className="p-4 bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto">
              {JSON.stringify(
                lastPayload || {
                  eventId: eventId || 'evt-001',
                  messageId: selectedMessageId || '<message-uuid>',
                  status,
                  occurredAt,
                },
                null,
                2
              )}
            </pre>
          </div>

          {/* HTTP Response Inspection */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">API Response Body</span>
              {httpStatus !== null && (
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                    httpStatus === 200
                      ? 'bg-emerald-100 text-emerald-800'
                      : httpStatus === 404
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  HTTP {httpStatus}
                </span>
              )}
            </div>

            {lastResponse !== null ? (
              <div className="p-4 space-y-3">
                {/* Visual Status Indicator Banner */}
                {httpStatus === 200 && lastResponse?.data && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
                      lastResponse.data.processingResult === 'APPLIED'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : lastResponse.data.processingResult === 'IGNORED'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-slate-100 border-slate-300 text-slate-900'
                    }`}
                  >
                    {lastResponse.data.processingResult === 'APPLIED' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    {lastResponse.data.processingResult === 'IGNORED' && (
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    {lastResponse.data.processingResult === 'DUPLICATE' && (
                      <Copy className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                    <div>
                      <span className="font-bold mr-1">[{lastResponse.data.processingResult}]</span>
                      {lastResponse.data.message}
                    </div>
                  </div>
                )}

                {/* Error Banner when HTTP != 200 */}
                {httpStatus !== 200 && (
                  <div className="p-3 rounded-lg border bg-rose-50 border-rose-200 text-rose-900 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>[{lastResponse?.error?.code || 'ERROR'}] {lastResponse?.error?.message || 'Request failed'}</span>
                    </div>
                    {lastResponse?.error?.details && (
                      <ul className="list-disc list-inside text-[11px] text-rose-700 pl-6 space-y-0.5">
                        {lastResponse.error.details.map((d: any, idx: number) => (
                          <li key={idx}>
                            <span className="font-mono font-semibold">{d.path}</span>: {d.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <pre className="p-3 bg-slate-950 text-slate-200 text-xs font-mono rounded-lg overflow-x-auto">
                  {JSON.stringify(lastResponse, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                Execute an action to inspect HTTP response status and body.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WebhookSimulatorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">Loading simulator...</div>}>
      <WebhookSimulatorContent />
    </Suspense>
  );
}
