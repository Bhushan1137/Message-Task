import {
  ApiResponse,
  CreateMessagePayload,
  DashboardStats,
  Message,
  MessageStatus,
  ProcessingResult,
  WebhookEvent,
  WebhookPayload,
  WebhookResponse,
  ConversationSummary,
} from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

class ApiClient {
  private currentTenantId: string = 'tenant-a';

  public setTenantId(tenantId: string) {
    this.currentTenantId = tenantId;
  }

  public getTenantId(): string {
    return this.currentTenantId;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requiresTenant: boolean = true
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (requiresTenant && this.currentTenantId) {
      headers.set('x-tenant-id', this.currentTenantId);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || `HTTP error ${response.status}: ${response.statusText}`);
      }

      return data as ApiResponse<T>;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network request failed';
      throw new Error(message);
    }
  }

  // Health Check
  async getHealth(): Promise<{ status: string; database: string; timestamp: string }> {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const res = await this.request<DashboardStats>('/api/v1/messages/stats');
    return res.data;
  }

  // Messages
  async createMessage(payload: CreateMessagePayload): Promise<Message> {
    const res = await this.request<Message>('/api/v1/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async getMessage(messageId: string): Promise<Message> {
    const res = await this.request<Message>(`/api/v1/messages/${messageId}`);
    return res.data;
  }

  async getMessages(params?: {
    limit?: number;
    cursor?: string;
    status?: MessageStatus;
    search?: string;
  }): Promise<{ messages: Message[]; nextCursor: string | null; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);

    const queryString = query.toString();
    const res = await this.request<Message[]>(
      `/api/v1/messages${queryString ? `?${queryString}` : ''}`
    );

    return {
      messages: res.data,
      nextCursor: res.pagination?.nextCursor ?? null,
      hasMore: res.pagination?.hasMore ?? false,
    };
  }

  // Conversations
  async getConversations(params?: {
    limit?: number;
    cursor?: string;
    search?: string;
  }): Promise<{ conversations: ConversationSummary[]; nextCursor: string | null; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.search) query.set('search', params.search);

    const queryString = query.toString();
    const res = await this.request<ConversationSummary[]>(
      `/api/v1/conversations${queryString ? `?${queryString}` : ''}`
    );

    return {
      conversations: res.data,
      nextCursor: res.pagination?.nextCursor ?? null,
      hasMore: res.pagination?.hasMore ?? false,
    };
  }

  async getConversationMessages(
    conversationId: string,
    params?: { limit?: number; cursor?: string }
  ): Promise<{ messages: Message[]; nextCursor: string | null; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);

    const queryString = query.toString();
    const res = await this.request<Message[]>(
      `/api/v1/conversations/${conversationId}/messages${queryString ? `?${queryString}` : ''}`
    );

    return {
      messages: res.data,
      nextCursor: res.pagination?.nextCursor ?? null,
      hasMore: res.pagination?.hasMore ?? false,
    };
  }

  // Webhooks
  async sendWebhook(payload: WebhookPayload): Promise<WebhookResponse> {
    // Simulated external provider boundary - no tenant header required
    const res = await this.request<WebhookResponse>(
      '/api/v1/webhooks/provider',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      false
    );
    return res.data;
  }

  async getWebhookEvents(params?: {
    limit?: number;
    cursor?: string;
    messageId?: string;
    processingResult?: ProcessingResult;
  }): Promise<{ events: WebhookEvent[]; nextCursor: string | null; hasMore: boolean }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.cursor) query.set('cursor', params.cursor);
    if (params?.messageId) query.set('messageId', params.messageId);
    if (params?.processingResult) query.set('processingResult', params.processingResult);

    const queryString = query.toString();
    const res = await this.request<WebhookEvent[]>(
      `/api/v1/webhooks/events${queryString ? `?${queryString}` : ''}`
    );

    return {
      events: res.data,
      nextCursor: res.pagination?.nextCursor ?? null,
      hasMore: res.pagination?.hasMore ?? false,
    };
  }

  async getRecentWebhookActivity(): Promise<WebhookEvent[]> {
    const res = await this.request<WebhookEvent[]>('/api/v1/webhooks/activity');
    return res.data;
  }
}

export const api = new ApiClient();
