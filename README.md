# Multi-Tenant Messaging Platform

A production-minded, full-stack multi-tenant messaging platform built with **Next.js (App Router)**, **Express.js**, **TypeScript**, **Prisma ORM**, and **PostgreSQL**. The platform features complete tenant-level data isolation, an atomic webhook state machine capable of handling out-of-order events, duplicate event prevention via database unique constraints and row-level locking, and an interactive Webhook Simulator.

---

## Table of Contents

1. [Single Repository Monorepo Architecture & GitHub Setup](#1-single-repository-monorepo-architecture--github-setup)
2. [Project Overview](#2-project-overview)
3. [Key Features](#3-key-features)
4. [Technology Stack](#4-technology-stack)
5. [System Architecture](#5-system-architecture)
6. [Folder Structure](#6-folder-structure)
7. [Database Schema](#7-database-schema)
8. [Environment Configuration](#8-environment-configuration)
9. [Installation & Setup](#9-installation--setup)
10. [Database Migrations & Seeding](#10-database-migrations--seeding)
11. [Application Startup Commands](#11-application-startup-commands)
12. [API Endpoint Documentation](#12-api-endpoint-documentation)
13. [Webhook Business Logic & Idempotency](#13-webhook-business-logic--idempotency)
14. [Tenant Isolation Model](#14-tenant-isolation-model)
15. [Automated Testing & Results](#15-automated-testing--results)
16. [Sample cURL Commands](#16-sample-curl-commands)
17. [Technical Trade-Offs](#17-technical-trade-offs)
18. [Known Limitations](#18-known-limitations)
19. [Production Scalability & The Outbox Pattern](#19-production-scalability--the-outbox-pattern)

---

## 1. Single Repository Monorepo Architecture & GitHub Setup

This entire project (both the **Next.js frontend** and the **Express.js backend**) is packaged as a **single unified monorepo** in one Git repository. There are no submodules, no separate repositories, and no detached trees.

### Pushing This Project to Your GitHub Repository

If you are publishing this project to your GitHub account:

```bash
# 1. From the project root, verify Git tracking status
git status

# 2. Add your GitHub remote repository (replace with your repo URL)
git remote add origin https://github.com/<your-username>/<your-repo-name>.git

# 3. Ensure branch name is main or master
git branch -M master

# 4. Push all commits (frontend, backend, migrations, and tests) to GitHub
git push -u origin master
```

### Why a Single Monorepo?
- **Unified CI/CD**: Run linting, integration tests, and end-to-end tests across both client and server from a single root command.
- **Atomic Commits**: Full-stack features (e.g. backend API updates and corresponding frontend screens) are tracked in cohesive Git commits.
- **Shared Workspace Tooling**: Root `package.json` with npm workspaces (`backend` and `frontend`) enables starting both servers concurrently with `npm run dev`.

---

## 2. Project Overview

In enterprise communications (e.g. WhatsApp Business API, Meta Cloud API, SMS gateways), downstream delivery notifications arrive asynchronously, frequently arrive out-of-order due to network retries, and can be duplicated. This platform provides:

- An authenticated tenant boundary for outbound message creation and thread retrieval.
- A simulated external provider webhook ingestion endpoint with atomic database transactions.
- Strict status transition validation and idempotency guarantees.
- An interactive SaaS management dashboard with a live Webhook Simulator and audit event logging.

---

## 3. Key Features

- **Multi-Tenant Isolation**: Enforced at the middleware and query level via the `x-tenant-id` header. Cross-tenant reads or updates return HTTP 404.
- **Out-of-Order Webhook Resolution**: Forward status jumps (`QUEUED` → `DELIVERED`, `QUEUED` → `READ`, `SENT` → `READ`) are safely applied, filling intermediate lifecycle timestamps. Stale backward events (e.g., `SENT` arriving after `READ`) are logged as `IGNORED` without mutating message state.
- **Strict Database Idempotency**: Concurrency-safe transactions with `FOR UPDATE` row locking and a database unique constraint on `WebhookEvent.eventId`. Duplicate deliveries return `DUPLICATE` without double-applying business effects.
- **Cursor-Based Pagination**: Stable composite cursor (`createdAt` + `id`) pagination across message listings and conversation timelines.
- **Interactive Webhook Simulator**: Real-time interface allowing developers to trigger simulated provider events (`SENT`, `DELIVERED`, `READ`, `FAILED`, and instant event replay) with live inspection of outgoing payloads and raw API responses.
- **Comprehensive Audit Trail**: Every received webhook event is recorded with its `occurredAt`, `receivedAt`, `processedAt`, and `processingResult` (`APPLIED`, `IGNORED`, `DUPLICATE`).

---

## 4. Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router) with React 19 & TypeScript
- **Styling**: Tailwind CSS with custom SaaS design tokens
- **State & Server Cache**: TanStack Query (React Query)
- **Forms & Validation**: React Hook Form with Zod schema validation
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js with TypeScript
- **Web Framework**: Express.js
- **ORM & Migrations**: Prisma ORM
- **Database**: PostgreSQL 16/18
- **Logging**: Pino structured logger with pino-pretty
- **Validation**: Zod schema validation

### Testing & Infrastructure
- **Integration Testing**: Jest & Supertest
- **E2E Testing**: Playwright
- **Containerization**: Docker & Docker Compose

---

## 5. System Architecture

```
                                  +------------------------------------+
                                  |     Next.js Frontend (Port 3000)   |
                                  |   Dashboard | Simulator | Logs     |
                                  +-----------------+------------------+
                                                    | HTTP (x-tenant-id)
                                                    v
+---------------------------------------------------+-----------------------------------+
|                           Express.js Backend (Port 4000)                              |
|                                                                                       |
|  [Middleware]                                                                         |
|    - Request ID (UUID)                                                                |
|    - CORS & JSON Body Parser                                                          |
|    - Tenant Validation Middleware (x-tenant-id verification)                          |
|                                                                                       |
|  [API Routes]                                                                         |
|    /api/v1/messages         -> MessageController     -> MessageService                |
|    /api/v1/conversations    -> ConversationRouter    -> MessageService (Pagination)   |
|    /api/v1/webhooks         -> WebhookController     -> WebhookService (Transactions) |
|    /health                  -> Health Check Handler  -> DB Ping                       |
|                                                                                       |
|  [Database Engine]                                                                    |
|    Prisma ORM -> PostgreSQL (Serializable Transactions + SELECT ... FOR UPDATE)      |
+---------------------------------------------------+-----------------------------------+
                                                    |
                                                    v
                                  +------------------------------------+
                                  |     PostgreSQL (Port 5432)         |
                                  |  tenants | messages | webhook_events|
                                  +------------------------------------+
```

---

## 6. Folder Structure

```
messaging-platform/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma            # Prisma schema (Tenant, Message, WebhookEvent)
│   │   ├── seed.ts                  # Seeds tenant-a and tenant-b
│   │   └── migrations/              # Versioned SQL migrations
│   ├── src/
│   │   ├── config/                  # Environment configuration
│   │   ├── middleware/              # tenant.middleware.ts, requestId.middleware.ts
│   │   ├── modules/
│   │   │   ├── messages/            # Controller, service, schemas, router
│   │   │   ├── conversations/       # Conversation timeline router
│   │   │   └── webhooks/            # Webhook controller, transaction service, router
│   │   ├── utils/                   # logger (Pino), database, errors, errorHandler
│   │   ├── app.ts                   # Express app factory
│   │   └── server.ts                # HTTP server bootstrap
│   ├── tests/
│   │   ├── setup/                   # globalSetup, globalTeardown, testHelpers
│   │   └── api.test.ts              # 23 comprehensive integration test suites
│   ├── jest.config.ts
│   ├── tsconfig.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Screen 1: Overview Dashboard
│   │   │   ├── messages/page.tsx    # Screen 2: Message Listing & Create
│   │   │   ├── conversations/page.tsx # Screen 3: Thread Timeline & Cursor Pag
│   │   │   ├── simulator/page.tsx   # Screen 4: Webhook Simulator
│   │   │   ├── events/page.tsx      # Screen 5: Webhook Event Logs
│   │   │   ├── layout.tsx           # Shell layout with Sidebar & Topbar
│   │   │   └── globals.css          # Tailwind CSS styling
│   │   ├── components/              # Sidebar, Topbar, Modals, StatusBadge, ResultBadge
│   │   ├── context/                 # TenantContext, ToastContext
│   │   ├── services/api.ts          # Centralized typed API client
│   │   ├── types/index.ts           # Shared TypeScript interfaces
│   │   └── lib/utils.ts             # cn helper, date formatting
│   ├── e2e/
│   │   └── workflow.spec.ts         # Playwright frontend end-to-end tests
│   ├── playwright.config.ts
│   ├── tsconfig.json
│   └── package.json
├── scripts/
│   └── ensure-db.js                 # Automatic DB verification helper
├── docker-compose.yml               # PostgreSQL container definition
├── package.json                     # Monorepo root workspaces
├── .env.example                     # Environment template
└── README.md
```

---

## 7. Database Schema

### `tenants`
| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | String | `@id` | Unique tenant slug (e.g. `tenant-a`, `tenant-b`) |
| `name` | String | | Display name of the tenant |
| `createdAt` | DateTime | `@default(now())` | Creation timestamp |
| `updatedAt` | DateTime | `@updatedAt` | Last modification timestamp |

### `messages`
| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | String (UUID) | `@id @default(uuid())` | Unique message identifier |
| `tenantId` | String | `@foreignKey -> Tenant.id` | Tenant isolation key |
| `conversationId` | String | `Indexed` | Thread / Conversation identifier |
| `to` | String | | E.164 recipient phone number |
| `text` | Text | | Content of the message |
| `status` | MessageStatus | `@default(QUEUED)` | `QUEUED`, `SENT`, `DELIVERED`, `READ`, `FAILED` |
| `createdAt` | DateTime | `@default(now())` | Timestamp when queued |
| `updatedAt` | DateTime | `@updatedAt` | Timestamp when status changed |
| `sentAt` | DateTime? | Nullable | Populated when `SENT` applied |
| `deliveredAt` | DateTime? | Nullable | Populated when `DELIVERED` applied |
| `readAt` | DateTime? | Nullable | Populated when `READ` applied |
| `failedAt` | DateTime? | Nullable | Populated when `FAILED` applied |

### `webhook_events`
| Column | Type | Attributes | Description |
|---|---|---|---|
| `id` | String (UUID) | `@id @default(uuid())` | Primary key |
| `eventId` | String | `@unique` | **Database unique constraint** for provider idempotency |
| `messageId` | String (UUID) | `@foreignKey -> Message.id` | Target message |
| `status` | MessageStatus | | Incoming status from provider |
| `occurredAt` | DateTime | | Event occurrence time according to provider |
| `receivedAt` | DateTime | `@default(now())` | Server reception time |
| `processedAt` | DateTime? | Nullable | Execution completion time |
| `processingResult`| ProcessingResult | | `APPLIED`, `IGNORED`, `DUPLICATE` |
| `errorDetails` | Text? | Nullable | Diagnostic details |

---

## 8. Environment Configuration

Copy `.env.example` into `backend/.env` and `frontend/.env.local`:

```bash
# Backend configuration (.env or backend/.env)
PORT=4000
NODE_ENV=development
LOG_LEVEL=info
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/messaging_platform?schema=public
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/messaging_platform_test?schema=public

# Frontend configuration (frontend/.env.local)
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 9. Installation & Setup

### Prerequisites
- **Node.js**: >= 18 (Node.js 20+ LTS recommended)
- **PostgreSQL**: Docker OR locally installed PostgreSQL on port 5432

### Step-by-Step Setup Guide

#### 1. Clone the Single Monorepo Repository
```bash
git clone https://github.com/<your-username>/<your-repo-name>.git
cd <your-repo-name>
```

#### 2. Install All Dependencies (Single Root Command)
Using npm workspaces, running `npm install` from the repository root installs dependencies for both `backend` and `frontend`:
```bash
npm install
```

#### 3. Start PostgreSQL
You can start PostgreSQL via Docker Compose:
```bash
docker compose up -d
```
*(Alternatively, if using a local PostgreSQL installation, ensure PostgreSQL is running on port `5432` with username `postgres` and password `postgres`).*

#### 4. Run Database Migrations & Seeds
Run Prisma migrations and populate initial tenants (`tenant-a` and `tenant-b`):
```bash
npm run db:migrate
npm run db:seed
```

---

## 10. Database Migrations & Seeding Reference

The following root convenience scripts manage the database state:
```bash
# Run latest database migrations
npm run db:migrate

# Seed required tenants (tenant-a, tenant-b)
npm run db:seed

# Reset database (wipes and re-applies migrations + seed)
npm run db:reset

# Open Prisma Studio GUI
npm run db:studio
```

---

## 11. Application Startup Commands

### Option A: Run Full Stack Concurrently (Recommended)
From the repository root, run:
```bash
npm run dev
```
This concurrently starts:
- **Express.js API**: [http://localhost:4000](http://localhost:4000)
- **Next.js Dashboard**: [http://localhost:3000](http://localhost:3000)

### Option B: Run Services Separately

**Terminal 1 — Backend:**
```bash
npm run dev:backend
# API available at http://localhost:4000
```

**Terminal 2 — Frontend:**
```bash
npm run dev:frontend
# Web UI available at http://localhost:3000
```

### Option C: Production Build
```bash
npm run build
```

---

## 12. API Endpoint Documentation

### A. Health Check
```http
GET /health
```
- **Response (200 OK)**:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-11-16T15:40:00.000Z"
}
```
- Returns `503 Service Unavailable` if the database is unreachable.

---

### B. Create Message
```http
POST /api/v1/messages
x-tenant-id: tenant-a
Content-Type: application/json
```
```json
{
  "tenantId": "tenant-a",
  "conversationId": "conv-100",
  "to": "+919876543210",
  "text": "Your order has shipped"
}
```
- **Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "e2f7b1c3-4d5e-6a7b-8c9d-0e1f2a3b4c5d",
    "tenantId": "tenant-a",
    "conversationId": "conv-100",
    "to": "+919876543210",
    "text": "Your order has shipped",
    "status": "QUEUED",
    "createdAt": "2026-11-16T15:40:00.000Z",
    "updatedAt": "2026-11-16T15:40:00.000Z",
    "sentAt": null,
    "deliveredAt": null,
    "readAt": null,
    "failedAt": null
  }
}
```

---

### C. Retrieve Message by ID
```http
GET /api/v1/messages/:messageId
x-tenant-id: tenant-a
```
- **Response (200 OK)**: Returns the message and all populated lifecycle timestamps.
- **Response (404 Not Found)**: Returned if the message ID does not exist or belongs to another tenant.

---

### D. Conversation History (Cursor Pagination)
```http
GET /api/v1/conversations/:conversationId/messages?limit=20&cursor=...
x-tenant-id: tenant-a
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "e2f7b1c3-4d5e-6a7b-8c9d-0e1f2a3b4c5d",
      "conversationId": "conv-100",
      "to": "+919876543210",
      "text": "Your order has shipped",
      "status": "DELIVERED",
      "createdAt": "2026-11-16T15:40:00.000Z"
    }
  ],
  "pagination": {
    "nextCursor": "MjAyNi0xMS0xNlQxNTo0MDowMC4wMDBafGUyZjdiMWMzLTRkNWUtNmE3Yi04YzlkLTBlMWYyYTNiNGM1ZA",
    "hasMore": false
  }
}
```

---

### E. Ingest Provider Webhook
```http
POST /api/v1/webhooks/provider
Content-Type: application/json
```
```json
{
  "eventId": "evt-001",
  "messageId": "e2f7b1c3-4d5e-6a7b-8c9d-0e1f2a3b4c5d",
  "status": "DELIVERED",
  "occurredAt": "2026-11-16T15:41:00.000Z"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "processingResult": "APPLIED",
    "message": "Status updated to DELIVERED",
    "currentStatus": "DELIVERED",
    "eventId": "evt-001"
  }
}
```

---

### F. Query Webhook Event Logs
```http
GET /api/v1/webhooks/events?messageId=...&processingResult=APPLIED&limit=20
x-tenant-id: tenant-a
```
- **Response (200 OK)**: Paginated audit trail of all webhook receipts filtered by tenant.

---

## 13. Webhook Business Logic & Idempotency

### Status Transition Matrix
The state machine enforces strict, non-regressive progression:

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

### Out-of-Order Transition Rules

| Current Status | Incoming Event | Result | Effect on Message Status | Notes |
|---|---|---|---|---|
| `QUEUED` | `SENT` | `APPLIED` | Updates to `SENT` | Sets `sentAt` |
| `QUEUED` | `DELIVERED` | `APPLIED` | Updates to `DELIVERED` | **Forward jump**: Sets `sentAt` & `deliveredAt` |
| `QUEUED` | `READ` | `APPLIED` | Updates to `READ` | **Forward jump**: Sets `sentAt`, `deliveredAt`, `readAt` |
| `QUEUED` | `FAILED` | `APPLIED` | Updates to `FAILED` | Sets `failedAt` |
| `SENT` | `DELIVERED` | `APPLIED` | Updates to `DELIVERED` | Sets `deliveredAt` |
| `SENT` | `READ` | `APPLIED` | Updates to `READ` | **Forward jump**: Sets `deliveredAt` & `readAt` |
| `SENT` | `FAILED` | `APPLIED` | Updates to `FAILED` | Sets `failedAt` |
| `DELIVERED` | `READ` | `APPLIED` | Updates to `READ` | Sets `readAt` |
| `DELIVERED` | `SENT` | `IGNORED` | Remains `DELIVERED` | Stale event; logged as `IGNORED` |
| `READ` | `SENT` | `IGNORED` | Remains `READ` | Terminal state; no backward movement |
| `READ` | `DELIVERED` | `IGNORED` | Remains `READ` | Terminal state; no backward movement |
| `FAILED` | `SENT` | `IGNORED` | Remains `FAILED` | Terminal state; no backward movement |
| `FAILED` | `DELIVERED` | `IGNORED` | Remains `FAILED` | Terminal state; no backward movement |

### Concurrency Protection & Idempotency Guarantees
1. **Row-Level Lock**: The webhook service begins a database transaction with `SERIALIZABLE` isolation and runs `SELECT id, status FROM messages WHERE id = $1 FOR UPDATE`. This blocks concurrent operations on the same message until the transaction commits.
2. **Database Unique Constraint**: `webhook_events(eventId)` has a strict Postgres `UNIQUE` constraint. If an event is re-sent or arrives simultaneously:
   - Within the transaction, existing `eventId` lookups return `DUPLICATE`.
   - Under heavy concurrent collisions where two transactions race, PostgreSQL raises code `P2002` (unique constraint violation), which our service catches and returns as `DUPLICATE` without double-updating message state.

---

## 14. Tenant Isolation Model

1. **Identity Extraction**: In this reference implementation, tenant identity is conveyed via the HTTP header `x-tenant-id`.
2. **Body Verification**: If `tenantId` is included in the request body of `POST /api/v1/messages`, the controller validates that `body.tenantId === req.tenantId`. If they do not match, HTTP `400 VALIDATION_ERROR` is returned.
3. **Query Scoping**: Every message, conversation, or event query enforces `WHERE "tenantId" = $tenantId`.
4. **404 Behavior**: Querying a message belonging to `tenant-b` while authenticated as `tenant-a` returns `404 NOT_FOUND` to prevent identifier enumeration.
5. **Production Note**: In production environments, tenant identity must be extracted from verified claims inside a cryptographically signed JSON Web Token (JWT) or hashed API key, never from raw client headers.

---

## 15. Automated Testing & Results

The automated test suite runs against an isolated PostgreSQL test database (`messaging_platform_test`).

### Running Tests
```bash
npm run test:backend
```

### Test Coverage Highlights (23 Passing Tests)
- **Health Check**: Validates 200 OK and DB connectivity.
- **Message Creation**: Verifies required fields, E.164 phone regex, body vs header tenant validation, and initial `QUEUED` status.
- **Message Retrieval**: Verifies ID lookups and 404 responses on cross-tenant access.
- **Cursor Pagination**: Verifies zero record duplication or omission across page boundaries using stable composite cursors.
- **Scenario A**: Progressive `QUEUED` → `SENT` → `DELIVERED` → `READ` execution.
- **Scenario B**: Out-of-order `READ` followed by `SENT` (verifies status remains `READ`).
- **Scenario C**: Repeated duplicate `eventId` submissions (verifies idempotency and single database record).
- **Scenario D**: Tenant isolation verification (tenant-b cannot access tenant-a messages).
- **Scenario E**: Concurrent race condition test firing simultaneous requests with identical `eventId` (verifies only one is accepted).
- **Forward Jumps & Terminal Ignorals**: Verifies `QUEUED` → `DELIVERED` jump and ignoral of `SENT` after `FAILED`.
- **Stale Timestamp Verification**: Verifies an incoming event with an older `occurredAt` timestamp is ignored.

---

## 16. Sample cURL Commands

### 1. Health Check
```bash
curl -X GET http://localhost:4000/health
```

### 2. Create Message (as tenant-a)
```bash
curl -X POST http://localhost:4000/api/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: tenant-a" \
  -d '{
    "conversationId": "order-101",
    "to": "+919876543210",
    "text": "Your delivery is out for dispatch"
  }'
```

### 3. Simulate SENT Webhook
```bash
curl -X POST http://localhost:4000/api/v1/webhooks/provider \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-meta-001",
    "messageId": "<MESSAGE_UUID>",
    "status": "SENT",
    "occurredAt": "2026-11-16T15:45:00.000Z"
  }'
```

### 4. Simulate Out-of-Order READ Webhook
```bash
curl -X POST http://localhost:4000/api/v1/webhooks/provider \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-meta-002",
    "messageId": "<MESSAGE_UUID>",
    "status": "READ",
    "occurredAt": "2026-11-16T15:46:00.000Z"
  }'
```

### 5. Attempt Cross-Tenant Access (tenant-b querying tenant-a)
```bash
curl -X GET http://localhost:4000/api/v1/messages/<MESSAGE_UUID> \
  -H "x-tenant-id: tenant-b"
# Returns 404 Not Found
```

---

## 17. Technical Trade-Offs

1. **Modular Monolith vs. Microservices**:
   - *Choice*: Built as a modular monorepo monolith with separate frontend and backend workspaces.
   - *Trade-Off*: Eliminates network overhead and complex distributed transactions (Sagas) while keeping codebase boundaries clean.
2. **Synchronous Webhook Ingestion vs. Async Queues**:
   - *Choice*: Synchronous database transaction execution with row-level locking.
   - *Trade-Off*: Extremely simple to reason about and guarantees immediate consistency, but holds open database connections during webhook spikes.
3. **Composite Cursor Pagination vs. Offset Pagination**:
   - *Choice*: Cursor based on `createdAt` + `id`.
   - *Trade-Off*: High query performance ($O(1)$ index lookups instead of $O(N)$ scan overhead) and resistance to missing or duplicate rows when new messages are added in real-time.

---

## 18. Known Limitations

- **Simulated Provider Boundary**: In production, WhatsApp and Meta webhook requests include an `X-Hub-Signature-256` HMAC SHA-256 header that must be cryptographically verified using an app secret. In this assignment, signature verification is bypassed to enable seamless local simulation.
- **Single Database Node**: Connection pooling and locking are bound to a single PostgreSQL instance. Highly distributed deployments would require connection pooling via PgBouncer or Supavisor.

---

## 19. Production Scalability & The Outbox Pattern

Under high traffic (e.g. 50,000+ webhook events per second), processing webhook events synchronously against PostgreSQL can exhaust database connection pools and induce lock contention.

### Recommended Production Evolution:
1. **Edge Buffer / Ingestion Layer**: An API Gateway or edge worker receives the webhook, verifies the HMAC signature, and immediately pushes the raw payload to an append-only distributed log (such as Apache Kafka, AWS SQS, or RabbitMQ) returning `202 Accepted` in <10ms.
2. **Transactional Outbox Pattern**: When outgoing messages are dispatched by the application, an outbox record is written in the same local database transaction as the message creation. A background relay (e.g., Debezium CDC or an outbox worker) reads outbox entries and publishes them to the external provider.
3. **Partitioned Consumer Workers**: Consumer workers consume webhook events partitioned by `messageId` (hash key). This guarantees that events for the same message are processed in sequential order on the same consumer thread, dramatically reducing lock contention and serialization conflicts.
