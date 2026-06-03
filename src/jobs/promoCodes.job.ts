import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../config/logger';
import { PromoCode } from '../models/PromoCode';

/** Cron expression: run at the top of every hour. */
const DEACTIVATE_SCHEDULE = '0 * * * *';

/**
 * Flip `isActive` to false for every promo code whose `expirationDate` has passed.
 * Returns the number of documents that were updated.
 */
export async function deactivateExpiredPromoCodes(): Promise<number> {
  const result = await PromoCode.updateMany(
    { isActive: true, expirationDate: { $lt: new Date() } },
    { $set: { isActive: false } }
  );
  return result.modifiedCount;
}

/**
 * Schedule the hourly sweep that deactivates expired promo codes.
 * Returns the task handle so callers can stop it on shutdown.
 */
export function startPromoCodeJobs(): ScheduledTask {
  return cron.schedule(
    DEACTIVATE_SCHEDULE,
    async () => {
      try {
        const deactivated = await deactivateExpiredPromoCodes();
        if (deactivated > 0) {
          logger.info(`Deactivated ${deactivated} expired promo code(s)`);
        }
      } catch (error) {
        logger.error('Failed to deactivate expired promo codes:', error);
      }
    },
    { name: 'deactivate-expired-promo-codes', noOverlap: true }
  );
}
