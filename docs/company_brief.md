# SCALETRIP CLOUD — COMPANY BRIEF
## Backend Platform Engineering Team · Onboarding Pack
### CONFIDENTIAL — INTERNAL USE ONLY

---

## THE COMPANY

**ScaleTrip Cloud** is a UK-based B2B SaaS company providing cloud-native booking infrastructure to travel agencies, hotel operators, booking aggregators, and airline consolidators across Europe and North America.

Founded in 2019. Headquartered in London (Shoreditch). 94 employees.
Series B funded (£28M). Investors: Balderton Capital, LocalGlobe.

The platform processes:
- **1.2 million booking events per month**
- **240,000 payment operations per month**
- **18TB of operational logs per month**
- Peak load: **47,000 concurrent sessions** during summer travel windows (June–August)

---

## YOUR ROLE

**Job Title:** Backend Platform Engineer (Mid-Level)
**Team:** Backend Platform Engineering (6 engineers, 1 Engineering Manager)
**Start Date:** 2 June 2026
**Reports To:** Priya Nair, Engineering Manager

You are joining at a critical moment. ScaleTrip's growth from 180,000 to 1.2 million monthly booking events over 18 months has introduced severe operational instability. The platform must be stabilised before the summer travel surge begins on **1 July 2026** — a hard deadline with contractual SLA commitments to 14 enterprise clients.

If the platform is not production-ready by 1 July, the company faces:
- £340,000 in SLA breach penalties
- Potential loss of the Travelport contract (£1.2M ARR)
- Reputational damage during peak hiring season for travel agencies

---

## THE PROBLEM — WHAT WENT WRONG

ScaleTrip's engineering team shipped rapidly through 2024–2025, prioritising feature velocity over platform stability. The result is a production platform with the following known issues:

### CRITICAL (P1 — must fix before July)
| Issue | Impact | Linked File |
|---|---|---|
| Duplicate booking creation during webhook retry storms | 3,842 duplicate bookings in Q1 2026. £82,000 compensation exposure | `booking_events.csv` |
| Payment idempotency not enforced | Double-charges on 0.3% of transactions. £14,200 overcharge exposure | `payment_webhooks.csv` |
| BullMQ queue has no dead-letter handling | Silent failures on ~12% of booking events during peak load | `queue_metrics.csv` |
| GitHub Actions CI pipeline broken on `main` | Deployments blocked for 11 days in March 2026 | `ci_pipeline_failures.csv` |

### HIGH (P2 — must fix before July)
| Issue | Impact | Linked File |
|---|---|---|
| `GET /bookings` query times out above 8,000 rows | p95 latency: 4,200ms. SLA requires <500ms | `api_performance_metrics.csv` |
| Auth service has no refresh token flow | Sessions expire silently. 14% session abandon rate | `process_notes.md` |
| Missing request correlation IDs across services | Incidents take 4.2× longer to diagnose | `process_notes.md` |
| No Kubernetes liveness/readiness probes | Pods crash without restart signals during scaling events | `process_notes.md` |

### MEDIUM (P3 — improve during sprint)
| Issue | Impact | Linked File |
|---|---|---|
| No Prometheus/Grafana observability stack | No metrics visibility during incidents | `process_notes.md` |
| Terraform configs incomplete for staging environment | Manual deployments required | `process_notes.md` |
| TypeScript compilation errors in booking-service | Build fails without `--skipLibCheck` flag | `process_notes.md` |

---

## THE HARD DEADLINE

**Go-live gate: 1 July 2026**

Sprint timeline:

| Sprint | Dates | Focus |
|---|---|---|
| Sprint 1 | 2–13 June 2026 | Architecture review, TypeScript refactor, database optimisation |
| Sprint 2 | 16–27 June 2026 | Auth hardening, queue refactor, Docker/Kubernetes |
| Sprint 3 | 30 June | Final CI/CD, AWS integrations, observability, sign-off |

**Certification gate:** Phase 5 (Event-Driven Booking Engine). Platform cannot be declared production-ready until the duplicate booking issue is resolved with verified queue deduplication evidence.

---

## THE TEAM — PERSONAS

### Priya Nair — Engineering Manager
**Avatar colour:** Purple
**Pressure:** Directly accountable to the CTO and the Travelport account manager for the July 1 delivery. Has been shielding the team from commercial pressure but is running out of time. Will escalate if sprint blockers are not resolved by end of Sprint 2.

> *"We have 14 enterprise clients on contractual SLAs. The team is excellent but the platform is fragile. I need someone who can dig into the real problems — not surface symptoms — and produce work I can show the board."*

### Marcus Webb — Outgoing Senior Backend Engineer
**Avatar colour:** Teal
**Pressure:** Leaving ScaleTrip on 20 June 2026 for a role at Monzo. Has documented as much as he can but the handover is incomplete. His process notes cover booking-service and auth-service but do NOT document the notification-service queue architecture, the payment webhook retry logic, or the AWS SQS integration. He knows the root cause of the duplicate booking bug but has not committed the fix.

> *"The queue deduplication issue is in the Redis lock implementation — or rather, the lack of one. I kept meaning to fix it but kept getting pulled onto other things. The answer is in the queue_metrics data if you know what you're looking for."*

### Callum Reid — Staff Infrastructure Engineer
**Avatar colour:** Amber
**Pressure:** Responsible for the AWS infrastructure and Kubernetes cluster. Has been managing the Kubernetes crashloop incidents manually. Has data on the API performance degradation and queue latency spikes but is swamped with the Travelport migration and needs the candidate to interpret the raw metrics.

> *"The performance data is in api_performance_metrics.csv. The slow query correlates with something specific in weeks 9–11 — look at the p95 column alongside the `db_conn_pool_exhausted` flag. It's not what it looks like on the surface."*

### Fatima Al-Hassan — Head of Compliance & Security
**Avatar colour:** Coral
**Pressure:** Responsible for GDPR audit readiness and PCI DSS awareness across the platform. Has flagged three compliance gaps that must be resolved before July 1: missing audit logging on tenant access, no data minimisation enforcement on booking export endpoints, and the auth service logging full JWTs to CloudWatch (a UK GDPR violation under ICO guidance).

> *"The auth service is logging full bearer tokens to CloudWatch. That is a reportable breach under Article 33 if those logs are compromised. It needs to be fixed before we can pass the ICO pre-audit. This is not optional."*

---

## KEY METRICS — LOCKED ANSWER KEY FIGURES

The following figures are calculable from the data files and must appear in candidate submissions:

| Metric | Value | Source File | Column |
|---|---|---|---|
| Duplicate booking rate (Q1 2026) | **18.7%** of total booking events | `booking_events.csv` | `is_duplicate` flag |
| Payment webhook retry storm duration | **4.2 hours** (peak: 14 March 2026) | `payment_webhooks.csv` | `retry_count` + `timestamp` |
| Dead-letter queue growth rate | **12.3%** of queue jobs per peak hour | `queue_metrics.csv` | `dlq_count` / `total_jobs` |
| CI pipeline failure rate (Q1 2026) | **34.8%** of pipeline runs failed | `ci_pipeline_failures.csv` | `status` column |
| p95 API latency (peak) | **4,247ms** (Week 10 peak) | `api_performance_metrics.csv` | `p95_latency_ms` |
| p95 API latency (after optimisation target) | **<500ms** | SLA requirement | — |
| Root cause of duplicate bookings | **Missing Redis distributed lock** in `booking-service/src/queue/bookingWorker.ts` | `queue_metrics.csv` | `lock_acquired` flag |
| JWT logging violation (GDPR) | Auth service logging `Authorization: Bearer [token]` to CloudWatch | `process_notes.md` | — |
| Slow query | `SELECT * FROM bookings WHERE tenant_id = $1 ORDER BY created_at DESC` — missing index on `(tenant_id, created_at)` | `api_performance_metrics.csv` | `slow_query_log` |
| Queue retry storm trigger | Webhook retry interval set to **500ms** instead of **exponential backoff** | `payment_webhooks.csv` | `retry_interval_ms` |

---

## REGULATORY CONTEXT

### UK GDPR (ICO)
- **Article 5(1)(c) — Data Minimisation:** Booking export endpoints must not return PII fields not requested by the consuming client. Current implementation returns full passenger records including passport numbers on all export calls.
- **Article 32 — Security of Processing:** Encrypted storage required for all PII at rest. Current PostgreSQL instance has unencrypted `passenger_details` column.
- **Article 33 — Breach Notification:** Auth service logging full JWTs to CloudWatch constitutes a potential data breach risk. Must be remediated before ICO pre-audit (15 July 2026).

### PCI DSS (Awareness)
- Payment service must not log full card numbers or CVV at any logging level. Current `payment-service/src/webhooks/handler.ts` logs the full `card_data` object at DEBUG level.
- Webhook endpoints must enforce HTTPS with TLS 1.2+. No enforcement currently in place.

### OWASP API Security Top 10
- **API1:2023 Broken Object Level Authorisation:** Booking endpoints accept `tenant_id` from request body rather than from verified JWT claims — allowing cross-tenant data access.
- **API3:2023 Broken Object Property Level Authorisation:** Booking response objects return internal fields (`internal_cost`, `margin_pct`) to external API consumers.
- **API8:2023 Security Misconfiguration:** CORS policy is `*` on all routes in `gateway/src/index.ts`.

### Operational Resilience
- All services must have health check endpoints (`/health`, `/ready`) before Kubernetes liveness probes can be configured.
- Incident response runbooks must be committed to `/incidents/` directory before go-live.

---

## SPRINT BOARD — BACKLOG ITEMS

| Ticket | Priority | Phase | Description |
|---|---|---|---|
| SCLT-001 | P1 | Phase 2 | Migrate booking-service routes to TypeScript with Zod validation |
| SCLT-002 | P1 | Phase 3 | Fix slow `GET /bookings` query — add composite index on `(tenant_id, created_at)` |
| SCLT-003 | P1 | Phase 3 | Add Redis caching layer for booking lookup endpoints |
| SCLT-004 | P1 | Phase 4 | Implement refresh token flow in auth-service |
| SCLT-005 | P1 | Phase 4 | Fix cross-tenant BOLA vulnerability in booking endpoints |
| SCLT-006 | P1 | Phase 5 | Add Redis distributed lock to bookingWorker to prevent duplicate processing |
| SCLT-007 | P1 | Phase 5 | Implement dead-letter queue handling in BullMQ booking queue |
| SCLT-008 | P1 | Phase 5 | Fix webhook retry interval — enforce exponential backoff |
| SCLT-009 | P2 | Phase 6 | Add liveness/readiness probes to all Kubernetes deployments |
| SCLT-010 | P2 | Phase 6 | Fix broken environment variable injection in staging Kubernetes config |
| SCLT-011 | P2 | Phase 7 | Repair GitHub Actions CI pipeline — fix ESLint config and test runner |
| SCLT-012 | P2 | Phase 7 | Write integration test suite for booking and auth endpoints |
| SCLT-013 | P2 | Phase 8 | Configure S3 artifact storage for booking exports |
| SCLT-014 | P2 | Phase 8 | Fix CloudWatch log group IAM permissions — stop logging full JWTs |
| SCLT-015 | P3 | Phase 9 | Deploy Prometheus + Grafana observability stack |
| SCLT-016 | P3 | Phase 9 | Add request correlation IDs to all service middleware |
| SCLT-017 | P3 | Phase 10 | Write ADRs for queue architecture and deployment strategy |
| SCLT-018 | P3 | Phase 10 | Produce production readiness sign-off document |

---

## GLOSSARY

| Term | Definition |
|---|---|
| DLQ | Dead-Letter Queue — messages that have failed all retry attempts |
| BullMQ | Redis-backed job queue library for Node.js |
| BOLA | Broken Object Level Authorisation (OWASP API1:2023) |
| p95 | 95th percentile response time — 95% of requests complete within this duration |
| idempotency | Property of an operation that produces the same result if executed multiple times |
| SLA | Service Level Agreement — contractual uptime and performance commitments |
| ADR | Architecture Decision Record — documented rationale for a technical decision |
| lock_acquired | Redis distributed lock flag in queue metrics — `false` = lock not held = duplicate risk |
| db_conn_pool_exhausted | PostgreSQL connection pool reached maximum — causes query queuing and latency spikes |
| INC-XXX | Incident reference number in `/incidents/` directory |
| SCLT-XXX | ScaleTrip JIRA-style ticket reference |
| retry_interval_ms | Time between webhook retry attempts — should use exponential backoff, not fixed interval |

---

*Document owner: Priya Nair (Engineering Manager)*
*Last updated: 2 June 2026*
*Classification: Internal — Backend Platform Team*
