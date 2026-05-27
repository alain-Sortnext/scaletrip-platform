import { Request, Response } from 'express';
import { logger } from '../../shared/utils/logger';

// DEPRECATED?: This retry logic was written by James Hollis (left Jan 2025).
// CHECK WITH CALLUM before modifying.
// FIXME: retry_interval is FIXED at 500ms — should be exponential backoff.
// This caused the 14 March 2026 webhook storm.
// See: data/payment_webhooks.csv — all rows have retry_interval_ms=500

const RETRY_CONFIG = {
  maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '10'),
  // BUG: This should be: Math.min(500 * Math.pow(2, attempt), 30000)
  intervalMs: parseInt(process.env.WEBHOOK_RETRY_INTERVAL_MS || '500'),
};

interface WebhookPayload {
  paymentRef: string;
  gateway: string;
  eventType: string;
  amount: number;
  status: string;
  cardData?: {  // WARNING: PCI DSS — card data should NEVER be logged (see below)
    last4: string;
    brand: string;
    // REMOVE: full card object should not even be in this interface
  };
}

export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as WebhookPayload;

  // PCI DSS VIOLATION: logs full card_data object at debug level
  logger.debug('Webhook received', { payload });  // ← DO NOT LOG card_data

  // Missing idempotency check — same paymentRef can be processed twice
  // TODO: Check Redis/DB for existing paymentRef before processing

  let attempt = 0;
  let success = false;

  while (attempt < RETRY_CONFIG.maxRetries && !success) {
    try {
      await processPaymentEvent(payload);
      success = true;
      res.json({ received: true, paymentRef: payload.paymentRef });
    } catch (err) {
      attempt++;
      logger.warn(`Webhook attempt ${attempt} failed`, { paymentRef: payload.paymentRef });

      if (attempt < RETRY_CONFIG.maxRetries) {
        // FIXME: Fixed delay — should be exponential backoff to prevent storm
        await sleep(RETRY_CONFIG.intervalMs);
      }
    }
  }

  if (!success) {
    logger.error('Webhook exhausted all retries', { paymentRef: payload.paymentRef });
    res.status(500).json({ error: 'Webhook processing failed after max retries' });
  }
};

async function processPaymentEvent(payload: WebhookPayload): Promise<void> {
  // Simulated processing — replace with real implementation
  if (Math.random() < 0.15) {
    throw new Error('Payment gateway timeout');
  }
  logger.info('Payment event processed', { paymentRef: payload.paymentRef, status: payload.status });
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
