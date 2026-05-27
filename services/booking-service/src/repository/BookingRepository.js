'use strict';
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

class BookingRepository {
  // WARNING: This query times out under heavy load.
  // Needs composite index on (tenant_id, created_at).
  // pgAdmin EXPLAIN ANALYZE shows sequential scan — 4.2s at 8k+ rows.
  // TODO: Add LIMIT + OFFSET pagination — this returns ALL rows with no limit (SCLT-002)
  async getBookingsByTenant(tenantId) {
    const result = await pool.query(
      `SELECT * FROM bookings
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  async getBookingById(id, tenantId) {
    // FIXME: tenant_id comes from params not JWT — BOLA vulnerability (SCLT-005)
    const result = await pool.query(
      'SELECT * FROM bookings WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0];
  }

  async createBooking(data) {
    const { bookingRef, tenantId, passengerId, route, amount, status } = data;
    const result = await pool.query(
      `INSERT INTO bookings (booking_ref, tenant_id, passenger_id, route, amount, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [bookingRef, tenantId, passengerId, route, amount, status]
    );
    return result.rows[0];
  }

  async updateBookingStatus(id, status) {
    const result = await pool.query(
      'UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    return result.rows[0];
  }
}

module.exports = { BookingRepository };
