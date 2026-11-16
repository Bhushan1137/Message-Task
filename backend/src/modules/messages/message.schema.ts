import { z } from 'zod';
import { MessageStatus } from '@prisma/client';

export const createMessageSchema = z.object({
  tenantId: z.string().optional(),
  conversationId: z.string().min(1, 'conversationId is required').max(100),
  to: z
    .string()
    .min(1, 'to (phone number) is required')
    .regex(/^\+[1-9]\d{7,14}$/, 'Phone number must be in E.164 format (e.g., +919876543210)'),
  text: z.string().min(1, 'text is required').max(4096, 'text is too long (max 4096 characters)'),
});

export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .refine((v) => v >= 1 && v <= 100, 'limit must be between 1 and 100'),
  cursor: z.string().optional(),
});

export const webhookPayloadSchema = z.object({
  eventId: z.string().min(1, 'eventId is required').max(255),
  messageId: z.string().uuid('messageId must be a valid UUID'),
  status: z.enum(['SENT', 'DELIVERED', 'READ', 'FAILED'], {
    errorMap: () => ({ message: 'status must be one of: SENT, DELIVERED, READ, FAILED' }),
  }),
  occurredAt: z
    .string()
    .datetime({ message: 'occurredAt must be a valid ISO 8601 datetime string' }),
});

export const messageFilterSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .refine((v) => v >= 1 && v <= 100, 'limit must be between 1 and 100'),
  cursor: z.string().optional(),
  status: z
    .enum(['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'])
    .optional() as z.ZodOptional<z.ZodEnum<[MessageStatus, ...MessageStatus[]]>>,
  search: z.string().optional(),
});

export const eventLogFilterSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .refine((v) => v >= 1 && v <= 100, 'limit must be between 1 and 100'),
  cursor: z.string().optional(),
  messageId: z.string().uuid().optional(),
  processingResult: z.enum(['APPLIED', 'IGNORED', 'DUPLICATE']).optional(),
});
