import { prisma } from '../../utils/database';
import { v4 as uuidv4 } from 'uuid';
import { Message, MessageStatus, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';
import { ValidationError } from '../../utils/errors';

export interface CreateMessageInput {
  tenantId: string;
  conversationId: string;
  to: string;
  text: string;
}

export interface PaginatedMessages {
  messages: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface MessageFilter {
  limit?: number;
  cursor?: string;
  status?: MessageStatus;
  search?: string;
}

function buildCursor(message: Message): string {
  const raw = `${message.createdAt.toISOString()}|${message.id}`;
  return Buffer.from(raw).toString('base64url');
}

function parseCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    const [dateStr, id] = decoded.split('|');
    if (!dateStr || !id) return null;
    return { createdAt: new Date(dateStr), id };
  } catch {
    return null;
  }
}

export async function createMessage(input: CreateMessageInput): Promise<Message> {
  const message = await prisma.message.create({
    data: {
      id: uuidv4(),
      tenantId: input.tenantId,
      conversationId: input.conversationId,
      to: input.to,
      text: input.text,
      status: 'QUEUED',
    },
  });

  logger.info(
    { messageId: message.id, tenantId: message.tenantId, conversationId: message.conversationId },
    'Message created'
  );

  return message;
}

export async function getMessageById(messageId: string, tenantId: string): Promise<Message | null> {
  return prisma.message.findFirst({
    where: { id: messageId, tenantId },
  });
}

export async function getMessages(tenantId: string, filter: MessageFilter): Promise<PaginatedMessages> {
  const limit = filter.limit ?? 20;
  const take = limit + 1; // fetch one extra to determine hasMore

  // Build where clause
  type WhereClause = {
    tenantId: string;
    status?: MessageStatus;
    OR?: Array<{ to?: { contains: string; mode: 'insensitive' }; conversationId?: { contains: string; mode: 'insensitive' }; text?: { contains: string; mode: 'insensitive' } }>;
    AND?: Array<{
      OR: Array<
        { createdAt: { lt: Date } } |
        { createdAt: Date; id: { lt: string } }
      >;
    }>;
  };

  const where: WhereClause = { tenantId };

  if (filter.status) {
    where.status = filter.status;
  }

  if (filter.search) {
    where.OR = [
      { to: { contains: filter.search, mode: 'insensitive' } },
      { conversationId: { contains: filter.search, mode: 'insensitive' } },
      { text: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  if (filter.cursor) {
    const parsed = parseCursor(filter.cursor);
    if (parsed) {
      where.AND = [
        {
          OR: [
            { createdAt: { lt: parsed.createdAt } },
            { createdAt: parsed.createdAt, id: { lt: parsed.id } },
          ],
        },
      ];
    }
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take,
  });

  const hasMore = messages.length > limit;
  const sliced = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? buildCursor(sliced[sliced.length - 1]) : null;

  return { messages: sliced, nextCursor, hasMore };
}

export async function getConversationMessages(
  tenantId: string,
  conversationId: string,
  filter: { limit?: number; cursor?: string }
): Promise<PaginatedMessages> {
  const limit = filter.limit ?? 20;
  const take = limit + 1;

  type ConvWhereClause = {
    tenantId: string;
    conversationId: string;
    AND?: Array<{
      OR: Array<
        { createdAt: { gt: Date } } |
        { createdAt: Date; id: { gt: string } }
      >;
    }>;
  };

  const where: ConvWhereClause = { tenantId, conversationId };

  if (filter.cursor) {
    const parsed = parseCursor(filter.cursor);
    if (parsed) {
      where.AND = [
        {
          OR: [
            { createdAt: { gt: parsed.createdAt } },
            { createdAt: parsed.createdAt, id: { gt: parsed.id } },
          ],
        },
      ];
    }
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take,
  });

  const hasMore = messages.length > limit;
  const sliced = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore ? buildCursor(sliced[sliced.length - 1]) : null;

  return { messages: sliced, nextCursor, hasMore };
}

export async function getConversations(
  tenantId: string,
  filter: { limit?: number; cursor?: string; search?: string }
): Promise<{ conversations: Array<{ conversationId: string; lastMessageAt: Date; messageCount: number }>; nextCursor: string | null; hasMore: boolean }> {
  const limit = filter.limit ?? 20;

  // Use raw query to get distinct conversations with counts - avoids groupBy TS issues
  type ConvRow = { conversationId: string; lastMessageAt: Date; messageCount: bigint };
  const cursorClause = filter.cursor
    ? Prisma.sql`AND m."conversationId" > ${filter.cursor}`
    : Prisma.empty;
  const searchClause = filter.search
    ? Prisma.sql`AND m."conversationId" ILIKE ${'%' + filter.search + '%'}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<ConvRow[]>`
    SELECT
      m."conversationId",
      MAX(m."createdAt") AS "lastMessageAt",
      COUNT(m.id)::int AS "messageCount"
    FROM messages m
    WHERE m."tenantId" = ${tenantId}
    ${searchClause}
    ${cursorClause}
    GROUP BY m."conversationId"
    ORDER BY MAX(m."createdAt") DESC
    LIMIT ${limit + 1}
  `;

  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;

  return {
    conversations: sliced.map((r) => ({
      conversationId: r.conversationId,
      lastMessageAt: r.lastMessageAt,
      messageCount: Number(r.messageCount),
    })),
    nextCursor: hasMore ? sliced[sliced.length - 1].conversationId : null,
    hasMore,
  };
}

export async function getDashboardStats(tenantId: string): Promise<{
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}> {
  const statuses: MessageStatus[] = ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'];

  const counts = await prisma.message.groupBy({
    by: ['status'],
    where: { tenantId },
    _count: { id: true },
  });

  const result = {
    total: 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
  };

  for (const item of counts) {
    const count = item._count.id;
    result.total += count;
    switch (item.status) {
      case 'QUEUED': result.queued = count; break;
      case 'SENT': result.sent = count; break;
      case 'DELIVERED': result.delivered = count; break;
      case 'READ': result.read = count; break;
      case 'FAILED': result.failed = count; break;
    }
  }

  return result;
}
