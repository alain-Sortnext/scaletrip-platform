# ScaleTrip Platform — Process Notes & Handover
## Author: Marcus Webb (Senior Backend Engineer)
## Status: INCOMPLETE — leaving 20 June 2026
## Last updated: 18 June 2026

---

> ⚠️ **READ THIS FIRST**
>
> These notes are incomplete. I've covered what I can before my last day.
> Booking-service and auth-service are reasonably documented below.
> Notification-service queue architecture — **NOT DOCUMENTED** (sorry, ran out of time).
> Payment webhook retry logic — **CHECK THIS WITH CALLUM** — I think the retry
> interval config is in `payment-service/src/config/webhooks.ts` but I'm not 100% sure.
> AWS SQS integration — **NOT DOCUMENTED** — Callum owns this entirely.
>
> The duplicate booking issue: I know what it is. Look at the `lock_acquired`
> column in `queue_metrics.csv`. When that's `false` during high-throughput
> periods, the booking worker is processing the same job twice. The fix is a
> Redis distributed lock *before* the database write in `bookingWorker.ts`.
> I kept meaning to implement it. It's about 15 lines of code.
>
> Good luck. — Marcus

---

## 1. ARCHITECTURE OVERVIEW (PARTIAL)

### Services I know well

```
booking-service     ← I built this. Notes below are complete-ish.
auth-service        ← I built the JWT layer. Refresh tokens are NOT implemented.
                       (see Section 3 — this is a known gap)
```

### Services I touched but don't own

```
payment-service     ← James Hollis built this before he left in Jan 2025.
                       Webhook handler in src/webhooks/handler.ts.
                       DEPRECATED? — the retry logic in there uses a fixed
                       interval. Pretty sure this is causing the storm issues.
                       CHECK THIS before going near it.

notification-service ← NOT DOCUMENTED. Ravi set this up. He's been gone
                       6 months. Queue config is somewhere in src/queues/.
                       BullMQ version might be out of date — check package.json.

audit-service        ← NOT DOCUMENTED. Partial logging only. Event schema
                       is inconsistent across services — some emit `event_type`,
                       some emit `eventType`. Nobody has fixed this.

analytics-service    ← NOT DOCUMENTED. I think it reads from a read replica.
                       Probably fine. Don't touch it before go-live.
```

### Infrastructure I don't own

```
AWS (S3, SQS, CloudWatch, DynamoDB)  ← Callum owns all of this
Kubernetes cluster                    ← Callum owns this
Terraform configs                     ← Callum started these, maybe 60% done
GitHub Actions pipelines              ← BROKEN since March 2026.
                                         ESLint config update broke the lint
                                         stage. Fix is in the backlog (SCLT-011).
                                         The `.eslintrc.json` in the root is
                                         referencing a plugin that was moved
                                         to `booking-service/.eslintrc.json`.
```

---

## 2. BOOKING-SERVICE — DETAILED NOTES

### What it does
Handles all booking creation, retrieval, update, and cancellation.
Exposes REST endpoints consumed by the API gateway.
Writes to PostgreSQL. Puts booking events on the BullMQ queue for async processing.

### Directory structure (as of June 2026)
```
booking-service/
├── src/
│   ├── routes/
│   │   ├── bookings.js          ← ⚠️ STILL JAVASCRIPT — needs TypeScript migration (SCLT-001)
│   │   └── health.js            ← /health endpoint exists but /ready does NOT
│   ├── controllers/
│   │   └── BookingController.js ← JS, not typed
│   ├── services/
│   │   └── BookingService.js    ← business logic lives here
│   ├── repository/
│   │   └── BookingRepository.js ← database queries — the slow one is here (line ~87)
│   ├── queue/
│   │   └── bookingWorker.ts     ← this is TypeScript already (I started the migration)
│   │                               THE DUPLICATE BUG IS HERE — no Redis lock before processBooking()
│   ├── middleware/
│   │   └── validation.js        ← weak validation, no Zod, just manual checks
│   └── index.js
├── tests/
│   ├── bookings.test.js
│   └── duplicate.test.js        ← describe.skip() — I skipped this. Needs fixing.
├── Dockerfile                   ← partial — missing the production stage
└── package.json
```

### The slow query (CRITICAL — SCLT-002)

In `BookingRepository.js` around line 87:

```javascript
// WARNING: This query times out under heavy load.
// Needs composite index on (tenant_id, created_at).
// pgAdmin EXPLAIN ANALYZE shows sequential scan — 4.2 seconds at 8k+ rows.
// Adding the index drops this to ~45ms. I tested locally.
async getBookingsByTenant(tenantId) {
  return this.db.query(
    `SELECT * FROM bookings
     WHERE tenant_id = $1
     ORDER BY created_at DESC`
    // TODO: add LIMIT + pagination — this returns ALL rows with no limit
    [tenantId]
  );
}
```

**Fix:** Run this migration before doing anything else in Phase 3:
```sql
CREATE INDEX CONCURRENTLY idx_bookings_tenant_created
ON bookings (tenant_id, created_at DESC);
```

Also needs a pagination layer — this endpoint returns unbounded results.
The Callum note in api_performance_metrics.csv about `db_conn_pool_exhausted`
is caused by this query holding connections open under load.

### The duplicate booking bug (CRITICAL — SCLT-006)

In `bookingWorker.ts`:

```typescript
// FIXME: Retry logic occasionally duplicates bookings
// during payment gateway latency spikes.
// TODO: Move booking reconciliation into async queue
// before Q3 traffic increase.
async processBooking(job: Job<BookingJobData>) {
  // ⚠️ NO REDIS LOCK HERE — this is the bug
  // If two workers pick up the same job simultaneously,
  // both will write to the database.
  // Fix: acquire Redis distributed lock keyed on booking_ref
  // BEFORE calling BookingService.create()
  const result = await BookingService.create(job.data);
  return result;
}
```

Redis is already in the stack (`docker-compose.yml`). The lock client
just needs to be instantiated and used. Pattern:
```typescript
const lock = await redisClient.set(
  `lock:booking:${job.data.bookingRef}`,
  'locked',
  { NX: true, PX: 30000 }
);
if (!lock) throw new Error('Duplicate job — lock already held');
```

### BullMQ queue config

Queue name: `booking-processing`
Redis connection: `REDIS_URL` env var (default `redis://localhost:6379`)
Concurrency: 5 workers (this is too high — causes lock contention. Reduce to 2.)
Dead-letter queue: **NOT CONFIGURED** — jobs silently disappear on failure
Retry config: 3 attempts, 1000ms fixed delay (should be exponential)

### Known test failures

`duplicate.test.js` is skipped:
```javascript
describe.skip("duplicate booking prevention", () => {
  // TODO: Fix after queue refactor
  // These tests pass locally but race condition means
  // they're flaky in CI — easier to skip than fix
});
```

---

## 3. AUTH-SERVICE — DETAILED NOTES

### What it does
JWT issuance and validation. Route protection middleware.
**What it DOES NOT do:** refresh tokens (not implemented), proper role separation,
audit logging of auth events.

### JWT implementation

```
Algorithm:    HS256
Secret:       JWT_SECRET env var (must be set — no default)
Expiry:       15 minutes (access token)
Refresh:      NOT IMPLEMENTED — this is SCLT-004
```

### Known security gaps (Fatima flagged these — CRITICAL before go-live)

1. **Full JWT logged to CloudWatch**
   In `auth-service/src/middleware/logger.ts` around line 34:
   ```javascript
   // ⚠️ UK GDPR VIOLATION — logs full Authorization header
   logger.info(`Request: ${req.method} ${req.path}`, {
     headers: req.headers  // ← this includes Authorization: Bearer <full_jwt>
   });
   ```
   Fix: strip `Authorization` from logged headers before calling logger.

2. **Cross-tenant BOLA vulnerability**
   In `booking-service/src/routes/bookings.js`:
   ```javascript
   // tenant_id comes from request BODY — attacker can spoof any tenant
   const { tenantId } = req.body;
   // Should be: const tenantId = req.user.tenantId; (from verified JWT)
   ```

3. **CORS policy is wildcard**
   In `gateway/src/index.ts`:
   ```typescript
   app.use(cors({ origin: '*' }));  // ← must be restricted to allowed origins
   ```

### Role structure (current — incomplete)

```
ADMIN   ← full access (works)
USER    ← read-only (works but not enforced on all routes)
AGENT   ← NOT IMPLEMENTED — placeholder only
AUDITOR ← NOT IMPLEMENTED — Fatima needs this for compliance
```

### Middleware chain (booking-service)

```
Request → cors() → json() → authMiddleware() → [route handler]
```

`authMiddleware()` verifies the JWT but does NOT check:
- Role permissions per route
- Tenant isolation (see BOLA above)
- Token expiry (it does check this — but silently returns 200 with expired token
  if `JWT_IGNORE_EXPIRY=true` is set in dev. CHECK that this env var is NOT set in staging.)

---

## 4. OPEN QUESTIONS (unresolved at handover)

| # | Question | Who to ask | Priority |
|---|---|---|---|
| 1 | Is the notification-service queue using the same Redis instance as booking-service? | Callum Reid | P1 |
| 2 | Which S3 bucket is used for booking export artifacts? Does it have versioning? | Callum Reid | P2 |
| 3 | Is the Terraform staging config actually deployed or just committed? | Callum Reid | P2 |
| 4 | Does the audit-service have a schema migration for the `eventType`/`event_type` inconsistency? | Nobody (Ravi left) | P1 |
| 5 | Is PCI DSS scoping done? Payment service logs `card_data` at DEBUG level. | Fatima Al-Hassan | P1 |
| 6 | What's the SLA definition for the Travelport contract specifically? | Priya Nair | P1 |
| 7 | Has CloudWatch log retention been set? Logs may be accumulating indefinitely (cost risk). | Callum Reid | P3 |

---

## 5. CONTACTS

| Name | Role | Best contact | Owns |
|---|---|---|---|
| **Priya Nair** | Engineering Manager | Slack `#backend-platform` | Sprint delivery, stakeholder comms |
| **Marcus Webb** | Senior Backend Eng (leaving 20 Jun) | Slack until 20 Jun then gone | booking-service, auth-service |
| **Callum Reid** | Staff Infrastructure Eng | Slack `#infra` | AWS, Kubernetes, Terraform, CI |
| **Fatima Al-Hassan** | Head of Compliance & Security | Email or Slack `#compliance` | GDPR, PCI DSS, audit |

---

## 6. ENVIRONMENT SETUP (what I know works)

```bash
# 1. Clone the repo
git clone https://github.com/scaletrip-cloud/scaletrip-platform.git
cd scaletrip-platform

# 2. Install dependencies
npm install

# 3. Copy env file
cp .env.example .env
# Edit .env — at minimum set:
#   DATABASE_URL, REDIS_URL, JWT_SECRET, NODE_ENV=development

# 4. Start services
docker-compose up -d   # starts postgres + redis

# 5. Run migrations
npm run migrate

# 6. Start booking-service
cd services/booking-service && npm run dev

# NOTE: TypeScript compilation will fail with errors unless you use --skipLibCheck
# This is a known issue — one of the first things to fix (SCLT-001)
```

---

## 7. WHAT I DIDN'T DOCUMENT (honest list)

```
❌ notification-service — queue config, retry logic, consumer groups
❌ payment-service — webhook handler internals, retry storm root cause
❌ analytics-service — read replica setup, query patterns
❌ AWS SQS integration — queue URLs, IAM roles, DLQ config
❌ Kubernetes YAML — why the staging pods keep crashlooping (Callum knows)
❌ Terraform — environment variable injection into K8s (this is the crashloop cause I think)
❌ Grafana/Prometheus — not set up at all. Completely TODO.
❌ Incident runbooks — none exist. Callum and I have been handling incidents ad-hoc.
❌ ADRs — no architecture decision records have ever been written for this platform.
```

Sorry. There wasn't enough time.

Good luck. The team is good. The platform has real problems but they're all fixable.

— Marcus

*Last commit: `a3f91c2` — "add partial TS types to booking-service (wip)"*
