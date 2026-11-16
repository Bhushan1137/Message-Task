'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Send, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useTenant } from '../context/TenantContext';
import { useToast } from '../context/ToastContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const createSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required').max(100),
  to: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+[1-9]\d{7,14}$/, 'Must be valid E.164 format (e.g., +919876543210)'),
  text: z.string().min(1, 'Message text is required').max(4096),
});

type FormData = z.infer<typeof createSchema>;

interface CreateMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultConversationId?: string;
}

export function CreateMessageModal({
  isOpen,
  onClose,
  defaultConversationId = '',
}: CreateMessageModalProps) {
  const { currentTenantId } = useTenant();
  const { success, error } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      conversationId: defaultConversationId || 'conv-100',
      to: '+919876543210',
      text: '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      if (defaultConversationId) {
        setValue('conversationId', defaultConversationId);
      } else {
        setValue('conversationId', `conv-${Math.floor(100 + Math.random() * 900)}`);
      }
    }
  }, [isOpen, defaultConversationId, setValue]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.createMessage({
        tenantId: currentTenantId,
        conversationId: data.conversationId,
        to: data.to,
        text: data.text,
      }),
    onSuccess: (data) => {
      success('Message created', `Message ${data.id.substring(0, 8)}... created with QUEUED status`);
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      reset();
      onClose();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to create message';
      error('Creation failed', msg);
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="font-semibold text-slate-900 text-lg">Create Outgoing Message</h3>
            <p className="text-xs text-slate-500">
              Sending as <span className="font-semibold text-slate-700">{currentTenantId}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Conversation ID
            </label>
            <input
              type="text"
              {...register('conversationId')}
              placeholder="conv-100"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {errors.conversationId && (
              <p className="text-xs text-rose-600 mt-1">{errors.conversationId.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Recipient Phone Number (E.164)
            </label>
            <input
              type="text"
              {...register('to')}
              placeholder="+919876543210"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            {errors.to && <p className="text-xs text-rose-600 mt-1">{errors.to.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Message Text
            </label>
            <textarea
              rows={4}
              {...register('text')}
              placeholder="Your order has been shipped and is on its way!"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-none"
            />
            {errors.text && <p className="text-xs text-rose-600 mt-1">{errors.text.message}</p>}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Create Message
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
