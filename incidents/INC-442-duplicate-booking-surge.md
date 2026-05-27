# INC-442 — Duplicate Booking Surge
**Date:** 14 March 2026
**Severity:** P1 — Critical
**Status:** Open — Root cause identified, fix not yet deployed
**Owner:** Marcus Webb (handover to new Backend Platform Engineer)

---

## Summary

A webhook retry storm triggered a surge in duplicate booking creation
across tenants T-001, T-002, and T-003 between 09:00 and 13:12 UTC
on 14 March 2026 (4 hours 12 minutes).

## Impact

- **3,842 duplicate bookings created** across 3 tenants
- **£82,000 estimated compensation exposure** (agency cancellation fees)
- **14 enterprise client reports** filed within 24 hours
- **Travelport escalation** — account manager contacted Priya Nair directly
- SLA breach: booking creation error rate exceeded 2% threshold for 4h 12m

## Timeline

| Time (UTC) | Event |
|---|---|
| 09:00 | First duplicate booking detected (T-003) |
| 09:15 | Monitoring alert triggered (no dashboard — manual log review) |
| 09:45 | Marcus Webb paged — begins investigation |
| 10:30 | Root cause identified: BullMQ worker processing same jobs twice |
| 11:00 | Attempted mitigation: scaled down workers from 5 to 1 |
| 11:15 | Duplicates reduced but not eliminated — lock still missing |
| 13:12 | Webhook storm subsided — payment gateway recovered |
| 14:00 | Priya Nair communications sent to affected tenants |

## Root Cause

The `booking-processing` BullMQ queue has no Redis distributed lock.
Under high throughput (triggered by the webhook retry storm from
payment-service), multiple workers simultaneously dequeue and process
the same job before BullMQ's internal deduplication activates.

Both workers call `BookingService.create()` — both succeed — both
write to the database — resulting in duplicate `booking_ref` entries
(the UNIQUE constraint on `booking_ref` should have caught this, but
the constraint was added AFTER the original table creation and does
not exist on the production database — see SCLT-TODO).

## Contributing Factors

1. No Redis distributed lock in `bookingWorker.ts`
2. Worker concurrency set to 5 (too high)
3. Fixed webhook retry interval (500ms) amplified job volume
4. No dead-letter queue — failed deduplication attempts silently dropped
5. No Prometheus/Grafana monitoring — incident discovered via manual logs
6. No runbook for this incident type

## Resolution Required

- [ ] Implement Redis distributed lock in `bookingWorker.ts` (SCLT-006)
- [ ] Configure dead-letter queue for booking-processing (SCLT-007)
- [ ] Fix webhook retry to use exponential backoff (SCLT-008)
- [ ] Reduce worker concurrency to 2 after lock is in place
- [ ] Add `UNIQUE` constraint on `booking_ref` to production DB
- [ ] Implement monitoring dashboard (SCLT-015)
- [ ] Write runbook for duplicate booking incidents

## Lessons Learned

- No observability = 45-minute detection delay
- No runbooks = ad-hoc response under pressure
- Compounding failures: three separate bugs amplified each other

*Filed by: Marcus Webb*
*Reviewed by: Priya Nair*
