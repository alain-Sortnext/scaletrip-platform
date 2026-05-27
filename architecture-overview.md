# ScaleTrip Platform — Architecture Overview
## Status: Partially documented — see process_notes.md for gaps

```
                          ┌─────────────────────┐
  External clients  ──►   │    API Gateway       │  :3000
  (agencies, OTAs)        │  (Express proxy)     │
                          └──────────┬──────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                       │
              ▼                      ▼                       ▼
    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │  booking-service │  │   auth-service   │  │ payment-service  │
    │     :3001        │  │     :3002        │  │     :3003        │
    │  [JS — needs TS] │  │  [TS — partial]  │  │  [TS — legacy]   │
    └────────┬─────────┘  └──────────────────┘  └────────┬─────────┘
             │                                            │
             ▼                                            ▼
    ┌──────────────────┐                       ┌──────────────────┐
    │  BullMQ Queue    │                       │  Webhook retry   │
    │  booking-proc.   │                       │  (fixed 500ms)   │
    │  [NO REDIS LOCK] │                       │  ← BUG          │
    └────────┬─────────┘                       └──────────────────┘
             │
             ▼
    ┌──────────────────┐         ┌──────────────────┐
    │   PostgreSQL     │         │   Redis          │
    │  (no index on    │         │  (used for queue │
    │   tenant_id +    │         │   — NOT for lock)│
    │   created_at)    │         │                  │
    └──────────────────┘         └──────────────────┘

NOT DOCUMENTED:
  notification-service ─── queue config unknown
  audit-service        ─── partial logging, schema inconsistent
  analytics-service    ─── read replica, do not touch

AWS (Callum owns):
  S3 ──── booking exports
  SQS ─── NOT FULLY CONFIGURED
  CloudWatch ── logs (JWT violation present)
  DynamoDB ─── session store (not active)

Kubernetes (Callum owns):
  Staging cluster on Minikube
  Pods crashlooping — wrong env var name (DB_URL vs DATABASE_URL)
  No liveness/readiness probes

Monitoring: NONE CONFIGURED
```
