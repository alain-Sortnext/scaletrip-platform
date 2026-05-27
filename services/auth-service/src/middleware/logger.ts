import winston from 'winston';

// ⚠️  UK GDPR VIOLATION — this logs the full Authorization header
// including Bearer <jwt_token> to CloudWatch.
// Flagged by Fatima Al-Hassan (Compliance) — must fix before ICO pre-audit.
// FIX: Strip Authorization header before logging (see SCLT-014)
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    // TODO: Replace with CloudWatch transport — currently just console
  ],
});

// Middleware that logs ALL headers — INCLUDING Authorization: Bearer <token>
export const requestLogger = (req: any, res: any, next: any) => {
  logger.info(`Request: ${req.method} ${req.path}`, {
    headers: req.headers,  // ← GDPR VIOLATION: logs full Authorization header
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
};
