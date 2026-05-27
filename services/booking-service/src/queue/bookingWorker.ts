import { Worker, Job, Queue, QueueEvents } from 'bullmq';
import { BookingService } from '../services/BookingService';
import { logger } from '../../../shared/utils/logger';

interface BookingJobData {
  bookingRef: string;
  tenantId: string;
  passengerId: string;
  route: string;
  amount: number;
}

// FIXME: Retry logic occasionally duplicates bookings
// during payment gateway latency spikes.
// TODO: Move booking reconciliation into async queue
// before Q3 traffic increase.
//
// ROOT CAUSE: No Redis distributed lock before processBooking().
// When two workers pick up the same job simultaneously under high load,
// both will write to the database — creating duplicate bookings.
//
// FIX REQUIRED: Acquire Redis lock keyed on bookingRef BEFORE calling
// BookingService.create(). Release lock after DB write completes.
// See process_notes.md Section 2 for implementation pattern.

const bookingQueue = new Queue('booking-processing', {
  connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      // WRONG: This should be 'exponential' not 'fixed'
      // Fixed backoff = retry storm under high load
      type: 'fixed',
      delay: 1000,
    },
    // TODO: Configure dead-letter queue (SCLT-007)
    // removeOnComplete: false,
    // removeOnFail: false,
  },
});

const worker = new Worker<BookingJobData>(
  'booking-processing',
  async (job: Job<BookingJobData>) => {
    logger.info(`Processing booking job ${job.id}`, { bookingRef: job.data.bookingRef });

    // ⚠️  NO REDIS LOCK HERE — this is the bug
    // Two workers can enter here simultaneously for the same job
    // Result: duplicate booking_ref written to database

    const result = await BookingService.create(job.data);

    logger.info(`Booking processed`, { bookingRef: job.data.bookingRef, id: result.id });
    return result;
  },
  {
    connection: { url: process.env.REDIS_URL || 'redis://localhost:6379' },
    // Concurrency of 5 is too high — increases duplicate probability
    // Reduce to 2 after adding Redis lock (SCLT-006)
    concurrency: 5,
  }
);

worker.on('failed', (job, err) => {
  // Jobs that exhaust retries are silently dropped — no DLQ configured
  logger.error(`Job ${job?.id} failed permanently`, { error: err.message });
  // TODO: Implement dead-letter queue handling (SCLT-007)
});

worker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

export { bookingQueue, worker };
