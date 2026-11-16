export type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export type ProcessingResult = 'APPLIED' | 'IGNORED' | 'DUPLICATE';

export interface Tenant {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  tenantId: string;
  conversationId: string;
  to: string;
  text: string;
  status: MessageStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
}

export interface WebhookEvent {
  id: string;
  eventId: string;
  messageId: string;
  status: MessageStatus;
  occurredAt: string;
  receivedAt: string;
  processedAt?: string | null;
  processingResult: ProcessingResult;
  errorDetails?: string | null;
  message?: {
    tenantId?: string;
    conversationId: string;
    to: string;
    status: MessageStatus;
  };
}

export interface ConversationSummary {
  conversationId: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface DashboardStats {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface PaginationInfo {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: PaginationInfo;
  error?: {
    code: string;
    message: string;
    details?: Array<{ path: string; message: string }>;
  };
}

export interface CreateMessagePayload {
  tenantId?: string;
  conversationId: string;
  to: string;
  text: string;
}

export interface WebhookPayload {
  eventId: string;
  messageId: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  occurredAt: string;
}

export interface WebhookResponse {
  processingResult: ProcessingResult;
  message: string;
  currentStatus?: MessageStatus;
  eventId: string;
}
