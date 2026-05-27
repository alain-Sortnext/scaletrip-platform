import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { logger } from '../shared/utils/logger';

const app = express();

// OWASP API Security: API8 — Security Misconfiguration
// CORS is open to all origins — must be restricted before go-live
app.use(cors({ origin: '*' }));  // TODO: restrict to allowed origins

app.use(express.json());

// Request logging — TODO: Add correlation ID middleware (SCLT-016)
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// Service routing
app.use('/api/bookings', createProxyMiddleware({
  target: process.env.BOOKING_SERVICE_URL || 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/bookings': '/bookings' },
}));

app.use('/api/auth', createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL || 'http://localhost:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '/auth' },
}));

app.use('/api/payments', createProxyMiddleware({
  target: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003',
  changeOrigin: true,
  pathRewrite: { '^/api/payments': '/payments' },
}));

// Gateway health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() });
});

// /ready endpoint missing — needed for Kubernetes readiness probe (SCLT-009)

const PORT = process.env.GATEWAY_PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Gateway running on port ${PORT}`);
});

export default app;
