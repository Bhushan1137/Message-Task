import { prisma } from '../../utils/database';
import { MessageStatus, ProcessingResult, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger';

export interface WebhookPayload {
  eventId: string;
  messageId: string;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  occurredAt: string;
}

export interface WebhookResult {
  processingResult: ProcessingResult;
  message: string;
  currentStatus?: MessageStatus;
  eventId: string;
}

// Status transition matrix
// Maps current status -> set of statuses that can be applied from it
const VALID_TRANSITIONS: Record<MessageStatus, MessageStatus[]> = {
  QUEUED: ['SENT', 'DELIVERED', 'READ', 'FAILED'],
  SENT: ['DELIVERED', 'READ', 'FAILED'],
  DELIVERED: ['READ'],
  READ: [],       // Terminal - no transitions
  FAILED: [],     // Terminal - no transitions
};

// Status rank for ordering (higher = more advanced)
const STATUS_RANK: Record<MessageStatus, number> = {
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  FAILED: 4,
};

function isValidTransition(current: MessageStatus, incoming: MessageStatus): boolean {
  return VALID_TRANSITIONS[current].includes(incoming);
}

// Get the timestamp field name for a given status
function getTimestampField(status: MessageStatus): string | null {
  switch (status) {
    case 'SENT': return 'sentAt';
    case 'DELIVERED': return 'deliveredAt';
    case 'READ': return 'readAt';
    case 'FAILED': return 'failedAt';
    default: return null;
  }
}

export async function processWebhook(payload: WebhookPayload): Promise<WebhookResult> {
  const receivedAt = new Date();
  const occurredAt = new Date(payload.occurredAt);
  const incomingStatus = payload.status as MessageStatus;

  // Use a database transaction with SERIALIZABLE isolation for concurrency safety.
  // This ensures that two simultaneous identical eventIds will not both succeed.
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 1. Find the message - lock it for update to prevent race conditions
        const message = await tx.$queryRaw<Array<{
          id: string;
          tenantId: string;
          status: MessageStatus;
          sentAt: Date | null;
          deliveredAt: Date | null;
          readAt: Date | null;
          failedAt: Date | null;
        }>>`
          SELECT id, "tenantId", status, "sentAt", "deliveredAt", "readAt", "failedAt"
          FROM messages
          WHERE id = ${payload.messageId}
          FOR UPDATE
        `;

        if (message.length === 0) {
          throw new Error('MESSAGE_NOT_FOUND');
        }

        const msg = message[0];

        // 2. Check for duplicate eventId (at DB level - enforced by unique constraint)
        const existingEvent = await tx.webhookEvent.findUnique({
          where: { eventId: payload.eventId },
        });

        if (existingEvent) {
          logger.info(
            { eventId: payload.eventId, messageId: payload.messageId },
            'Duplicate webhook event - already processed'
          );
          return {
            processingResult: 'DUPLICATE' as ProcessingResult,
            message: 'Duplicate event - already processed',
            currentStatus: msg.status,
            eventId: payload.eventId,
            skipEventStore: true,
            existingEvent,
          };
        }

        // 3. Check for stale event using occurredAt
        // Collect all currently recorded lifecycle event timestamps
        const recordedTimestamps = [msg.sentAt, msg.deliveredAt, msg.readAt, msg.failedAt]
          .filter((d): d is Date => d !== null)
          .map((d) => new Date(d).getTime());

        const latestRecordedTime =
          recordedTimestamps.length > 0 ? Math.max(...recordedTimestamps) : null;

        const isStale =
          latestRecordedTime !== null && occurredAt.getTime() < latestRecordedTime;

        // 4. Determine if transition is valid
        const canTransition = isValidTransition(msg.status, incomingStatus);
        const shouldApply = canTransition && !isStale;

        let processingResult: ProcessingResult;
        let ignoreReason = '';
        let messageUpdate: Prisma.MessageUpdateInput = {};

        if (shouldApply) {
          processingResult = 'APPLIED';

          // Build timestamp update - set when first applied; never overwrite existing timestamps
          const tsField = getTimestampField(incomingStatus);
          if (tsField) {
            const existing = msg[tsField as keyof typeof msg] as Date | null;
            if (!existing) {
              messageUpdate[tsField as keyof Prisma.MessageUpdateInput] = occurredAt;
            }
          }

          messageUpdate.status = incomingStatus;
          messageUpdate.updatedAt = new Date();

          // Apply forward jumps: if skipping statuses, fill intermediate timestamps
          if (incomingStatus === 'DELIVERED' && msg.status === 'QUEUED') {
            if (!msg.sentAt) messageUpdate.sentAt = occurredAt;
          } else if (incomingStatus === 'READ') {
            if (msg.status === 'QUEUED') {
              if (!msg.sentAt) messageUpdate.sentAt = occurredAt;
              if (!msg.deliveredAt) messageUpdate.deliveredAt = occurredAt;
            } else if (msg.status === 'SENT') {
              if (!msg.deliveredAt) messageUpdate.deliveredAt = occurredAt;
            }
          }

          // Update the message
          await tx.message.update({
            where: { id: payload.messageId },
            data: messageUpdate,
          });

          logger.info(
            {
              eventId: payload.eventId,
              messageId: payload.messageId,
              from: msg.status,
              to: incomingStatus,
            },
            'Webhook status transition applied'
          );
        } else {
          processingResult = 'IGNORED';
          if (isStale) {
            ignoreReason = `Event ignored: event timestamp (${occurredAt.toISOString()}) is older than latest applied timestamp (${new Date(
              latestRecordedTime!
            ).toISOString()})`;
          } else {
            ignoreReason = `Event ignored: transition from ${msg.status} to ${incomingStatus} is not allowed`;
          }

          logger.info(
            {
              eventId: payload.eventId,
              messageId: payload.messageId,
              currentStatus: msg.status,
              incomingStatus,
              isStale,
              reason: ignoreReason,
            },
            'Webhook event ignored'
          );
        }

        // 5. Store the webhook event (even if ignored, distinct events must be persisted)
        const event = await tx.webhookEvent.create({
          data: {
            eventId: payload.eventId,
            messageId: payload.messageId,
            status: incomingStatus,
            occurredAt,
            receivedAt,
            processedAt: new Date(),
            processingResult,
          },
        });

        return {
          processingResult,
          message:
            processingResult === 'APPLIED'
              ? `Status updated to ${incomingStatus}`
              : ignoreReason,
          currentStatus: processingResult === 'APPLIED' ? incomingStatus : msg.status,
          eventId: payload.eventId,
          skipEventStore: false,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      }
    );

    return {
      processingResult: result.processingResult,
      message: result.message,
      currentStatus: result.currentStatus,
      eventId: result.eventId,
    };
  } catch (err: unknown) {
    // Handle the MESSAGE_NOT_FOUND sentinel
    if (err instanceof Error && err.message === 'MESSAGE_NOT_FOUND') {
      throw err;
    }

    // Handle unique constraint violation - this means a concurrent request
    // already inserted the same eventId. Treat as duplicate.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      logger.warn(
        { eventId: payload.eventId, messageId: payload.messageId },
        'Concurrent duplicate webhook event detected via unique constraint'
      );
      return {
        processingResult: 'DUPLICATE',
        message: 'Duplicate event - concurrent request already processed',
        eventId: payload.eventId,
      };
    }

    // Serialization failure - retry once
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === 'P2034' || (err.message && err.message.includes('serialize')))
    ) {
      logger.warn({ eventId: payload.eventId }, 'Serialization failure, retrying once...');
      // On serialization failure, the duplicate will be caught on retry
      return processWebhook(payload);
    }

    throw err;
  }
}

export interface EventLogFilter {
  limit?: number;
  cursor?: string;
  messageId?: string;
  processingResult?: ProcessingResult;
  tenantId?: string;
}

export async function getWebhookEvents(filter: EventLogFilter) {
  const limit = filter.limit ?? 20;
  const take = limit + 1;

  const where: Prisma.WebhookEventWhereInput = {};

  if (filter.messageId) {
    where.messageId = filter.messageId;
  }

  if (filter.processingResult) {
    where.processingResult = filter.processingResult;
  }

  // Enforce tenant isolation through the message relation
  if (filter.tenantId) {
    where.message = { tenantId: filter.tenantId };
  }

  if (filter.cursor) {
    where.id = { lt: filter.cursor };
  }

  const events = await prisma.webhookEvent.findMany({
    where,
    orderBy: { receivedAt: 'desc' },
    take,
    include: {
      message: {
        select: { tenantId: true, conversationId: true, to: true, status: true },
      },
    },
  });

  const hasMore = events.length > limit;
  const sliced = hasMore ? events.slice(0, limit) : events;
  const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

  return {
    events: sliced,
    nextCursor,
    hasMore,
  };
}

export async function getRecentWebhookActivity(tenantId: string, limit = 10) {
  return prisma.webhookEvent.findMany({
    where: { message: { tenantId } },
    orderBy: { receivedAt: 'desc' },
    take: limit,
    include: {
      message: {
        select: { conversationId: true, to: true, status: true },
      },
    },
  });
}
