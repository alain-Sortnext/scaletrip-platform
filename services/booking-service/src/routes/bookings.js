'use strict';
// TODO: Migrate this file to TypeScript (SCLT-001)
// This is the last JS file in booking-service — TS migration started in queue/

const express = require('express');
const router = express.Router();
const { BookingController } = require('../controllers/BookingController');
const { authMiddleware } = require('../middleware/auth');

const controller = new BookingController();

// GET /bookings — returns ALL bookings for tenant (no pagination — SCLT-002)
// ⚠️  SLOW — see BookingRepository.js warning
router.get('/', authMiddleware, async (req, res) => {
  try {
    // BUG: tenantId from body/query not JWT — BOLA vulnerability (SCLT-005)
    const tenantId = req.query.tenant_id || req.body.tenantId;
    const bookings = await controller.getByTenant(tenantId);
    res.json({ data: bookings, count: bookings.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /bookings/:id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.query.tenant_id; // ← should come from req.user.tenantId
    const booking = await controller.getById(req.params.id, tenantId);
    if (!booking) return res.status(404).json({ error: 'Not found' });
    res.json({ data: booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /bookings — creates booking AND enqueues async job
router.post('/', authMiddleware, async (req, res) => {
  try {
    // Weak validation — no Zod schema (SCLT-001)
    const { bookingRef, route, amount } = req.body;
    if (!bookingRef || !route || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Missing idempotency check — same bookingRef can be submitted twice
    const booking = await controller.create(req.body);
    res.status(201).json({ data: booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DEPRECATED: Use POST /bookings instead
// TODO: Remove after all clients migrated (unknown deadline)
router.post('/legacy/create', authMiddleware, async (req, res) => {
  console.warn('DEPRECATED endpoint called: POST /bookings/legacy/create');
  return res.redirect(307, '/bookings');
});

// /health exists — /ready does NOT (needed for K8s probes — SCLT-009)
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'booking-service' });
});

module.exports = router;
