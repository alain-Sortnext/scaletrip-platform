-- ScaleTrip Platform — Database Schema + Seed Data
-- Run via: npm run migrate

CREATE TABLE IF NOT EXISTS tenants (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  tier VARCHAR(20) DEFAULT 'standard',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  booking_ref VARCHAR(20) UNIQUE NOT NULL,
  tenant_id VARCHAR(10) REFERENCES tenants(id),
  passenger_id VARCHAR(50),
  route VARCHAR(20) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  is_duplicate BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- TODO: Add this index before Phase 3 work (SCLT-002)
-- CREATE INDEX CONCURRENTLY idx_bookings_tenant_created
-- ON bookings (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  tenant_id VARCHAR(10) REFERENCES tenants(id),
  role VARCHAR(20) DEFAULT 'USER',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed tenants
INSERT INTO tenants (id, name, tier) VALUES
  ('T-001', 'Horizon Travel Agency', 'enterprise'),
  ('T-002', 'Meridian Hotels Group', 'enterprise'),
  ('T-003', 'FastFly Consolidators', 'standard'),
  ('T-004', 'BlueSky Booking Platform', 'standard'),
  ('T-005', 'Travelport UK Ltd', 'enterprise'),
  ('T-006', 'SkyLink Aggregators', 'standard')
ON CONFLICT DO NOTHING;

-- Seed admin user (CHANGE PASSWORD IN PRODUCTION)
INSERT INTO users (email, password_hash, tenant_id, role) VALUES
  ('admin@scaletrip.io', '$2b$10$placeholder_hash_change_me', 'T-001', 'ADMIN')
ON CONFLICT DO NOTHING;
