# System Design Note: Multi-Tenant Messaging Platform

This document outlines the architectural principles, concurrency patterns, and data consistency models implemented in the Multi-Tenant Messaging Platform.

---

## 1. Idempotency & Concurrency Protection

In distributed messaging, webhook deliveries are **at-least-once**. Downstream webhooks can arrive duplicated, burst in parallel, or experience network retries.

### Two-Tier Protection Mechanism

1. **Pessimistic Concurrency (Row-Level Locking)**:
   - When processing a webhook payload, the execution begins inside a Prisma database transaction with `SERIALIZABLE` isolation.
   - It executes `SELECT id, status FROM messages WHERE id = $1 FOR UPDATE`.
   - This places an exclusive row lock on the target message. Concurrent incoming webhooks targeting the same message wait until the active transaction commits, preventing race conditions or dirty reads during state transitions.

2. **Database Unique Constraint**:
   - `WebhookEvent.eventId` is protected by a PostgreSQL `UNIQUE` constraint at the database storage layer.
   - Even under high-throughput concurrent collisions, PostgreSQL immediately rejects a secondary insert with error code `P2002` (Unique constraint violation).
   - The application intercepts this violation and gracefully returns:
     ```json
     {
       "processingResult": "DUPLICATE",
       "message": "Duplicate eventId: evt-xxx has already been processed"
     }
     ```
   - **Crucial Rule**: Idempotency is never reliant solely on in-memory JavaScript state; the relational database is the single source of truth.

---

## 2. Status Transitions & Out-of-Order Resolution

### Finite State Machine Matrix

The lifecycle follows strict forward progression:
- **Forward Flow**: `QUEUED` → `SENT` → `DELIVERED` → `READ`
- **Failure Flow**: `QUEUED` → `FAILED` | `SENT` → `FAILED`
- **Terminal States**: `READ` and `FAILED` (cannot transition to any other status)

```
                 +-----------------------------------+
                 |              QUEUED               |
                 +---+------------+--------------+---+
                     |            |              |
                     v            |              v
                 +---+---+        |         +----+----+
                 | SENT  |        |         | FAILED  | (Terminal)
                 +---+---+        |         +---------+
                     |            |
                     v            v
                 +---+------------+---+
                 |     DELIVERED      |
                 +---------+----------+
                           |
                           v
                 +---------+----------+
                 |        READ        | (Terminal)
                 +--------------------+
```

### Out-of-Order and Forward Jumps

- **Valid Forward Jumps**: If network latency delays a `SENT` webhook and a `DELIVERED` or `READ` webhook arrives first, the state machine applies the forward jump (`QUEUED` → `DELIVERED` or `QUEUED` → `READ`) and fills in the intermediate lifecycle timestamps (`sentAt`, `deliveredAt`).
- **Backward Regressions (Stale Events)**: If an older event (e.g. `SENT`) arrives after a message has already reached `DELIVERED`, `READ`, or `FAILED`, the transition is rejected. The event is persisted to `WebhookEvent` with `processingResult = "IGNORED"` and reason logged, while the message status remains untouched.
- **Timestamp Staleness Check**: Each incoming event's `occurredAt` timestamp is verified against the latest recorded state timestamp. If `occurredAt < latestTimestamp`, the event is deemed chronologically stale and recorded as `IGNORED`.

---

## 3. Tenant Isolation

The platform enforces data isolation across tenants (`tenant-a`, `tenant-b`):

1. **Request Authentication Boundary**:
   - Every protected route passes through `tenant.middleware.ts`, which extracts and validates the `x-tenant-id` header against valid database tenants.
2. **Body Validation Consistency**:
   - On `POST /api/v1/messages`, if `tenantId` is supplied in the request payload, it is strictly validated against the header identity. Mismatches return HTTP `400 VALIDATION_ERROR`.
3. **Strict Query Scoping**:
   - Every retrieval query (`messages`, `conversations`, `events`) is explicitly scoped:
     ```sql
     WHERE "tenantId" = $authenticatedTenantId
     ```
4. **Information Leakage Prevention**:
   - If an authenticated tenant attempts to access a message ID or conversation belonging to a different tenant, the API returns **HTTP 404 Not Found** (rather than 403 Forbidden). This prevents malicious actors from discovering valid message UUIDs across tenant boundaries.

---

## 4. Production Evolution & Scalability

While the current synchronous transactional model guarantees immediate consistency, enterprise scale (50,000+ msg/sec) requires an asynchronous, event-driven architecture.

### Architectural Blueprint for Scale

```
                                  +-----------------------+
                                  | External Provider Webhook
                                  +-----------+-----------+
                                              |
                                              v
                              +---------------+---------------+
                              |    Fast Ingestion Gateway     |  (HMAC SHA-256 Auth,
                              |     (Edge / Serverless)       |   < 10ms Response)
                              +---------------+---------------+
                                              |
                                              v
                              +---------------+---------------+
                              |   Kafka / AWS SQS Buffer      |  (Partitioned by
                              |  (topic: provider-webhooks)   |   messageId)
                              +---------------+---------------+
                                              |
                                              v
                              +---------------+---------------+
                              |   Distributed Worker Pool     |  (Sequential per
                              |  (De-duplication + FSM Logic) |   message partition)
                              +---------------+---------------+
                                              |
                                              v
                              +---------------+---------------+
                              | PostgreSQL (Read Replicas +   |
                              |   Connection Pooling/PgBouncer)
                              +-------------------------------+
```

1. **Edge Ingestion with HMAC Verification**:
   - Replace open webhook endpoints with signature validation (`X-Hub-Signature-256` HMAC-SHA256).
   - Ingest payloads and immediately publish them to an append-only distributed event stream (Apache Kafka / AWS SQS) with HTTP `202 Accepted` in <10ms.
2. **Partitioning by `messageId`**:
   - Using `messageId` as the Kafka partition key ensures all events for any given message land on the same consumer worker in strict chronological arrival order, eliminating distributed locking contention.
3. **Transactional Outbox Pattern**:
   - Outgoing messages write to an `outbox` table in the same transaction as message creation. An asynchronous CDC relay (Debezium or polling worker) reads outbox rows and dispatches to provider APIs, guaranteeing reliable at-least-once delivery without dual-write inconsistencies.
4. **Cryptographic Tenant Authentication**:
   - Replace arbitrary `x-tenant-id` headers with signed JWTs (RS256) or hashed API keys (`Bearer sk_live_...`), verified via asymmetric public key cryptography at the API gateway layer.
