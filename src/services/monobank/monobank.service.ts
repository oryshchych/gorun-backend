import { paymentConfig } from '../../config/env';
import { logger } from '../../config/logger';

/**
 * Service for interacting with Monobank API
 * Documentation: https://monobank.ua/api-docs/acquiring/
 */

/**
 * Fetch public key from Monobank API for webhook signature verification.
 * The key is cached in memory (it rarely changes); pass `forceRefresh` to
 * re-fetch when a signature fails to verify against the cached key (rotation).
 * Documentation: https://monobank.ua/api-docs/acquiring/dev/webhooks/get--api--merchant--pubkey
 */
let cachedPublicKey: string | null = null;

export async function getPublicKey(forceRefresh = false): Promise<string | null> {
  if (cachedPublicKey && !forceRefresh) return cachedPublicKey;

  if (!paymentConfig.plataApiKey) {
    logger.warn('Monobank API key not configured, cannot fetch public key');
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://api.monobank.ua/api/merchant/pubkey', {
      method: 'GET',
      headers: {
        'X-Token': paymentConfig.plataApiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.error('Failed to fetch Monobank public key', {
        status: response.status,
      });
      return null;
    }

    const data = (await response.json()) as { key?: string };
    cachedPublicKey = data.key ?? null;
    return cachedPublicKey;
  } catch (error) {
    logger.error('Error fetching Monobank public key', { error });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Get invoice status from Monobank
 * Documentation: https://monobank.ua/api-docs/acquiring/methods/ia/get--api--merchant--invoice--status
 * Note: Should not be used as primary mechanism. Use webhooks instead.
 */
export async function getInvoiceStatus(invoiceId: string): Promise<Record<string, unknown> | null> {
  if (!paymentConfig.plataApiKey) {
    logger.warn('Monobank API key not configured, cannot fetch invoice status');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
      {
        method: 'GET',
        headers: {
          'X-Token': paymentConfig.plataApiKey,
        },
      }
    );

    if (!response.ok) {
      logger.error('Failed to fetch invoice status', {
        status: response.status,
        invoiceId,
      });
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    return data;
  } catch (error) {
    logger.error('Error fetching invoice status', { error, invoiceId });
    return null;
  }
}

/**
 * Cancel payment (refund) for an invoice
 * Documentation: https://monobank.ua/api-docs/acquiring/methods/ia/post--api--merchant--invoice--cancel
 */
export async function cancelInvoice(
  invoiceId: string,
  amount?: number,
  extRef?: string
): Promise<Record<string, unknown> | null> {
  if (!paymentConfig.plataApiKey) {
    logger.warn('Monobank API key not configured, cannot cancel invoice');
    return null;
  }

  try {
    const body: Record<string, unknown> = {
      invoiceId,
    };

    if (amount !== undefined) {
      body.amount = Math.round(amount * 100); // Convert to kopiykas
    }

    if (extRef !== undefined) {
      body.extRef = extRef;
    }

    const response = await fetch('https://api.monobank.ua/api/merchant/invoice/cancel', {
      method: 'POST',
      headers: {
        'X-Token': paymentConfig.plataApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      logger.error('Failed to cancel invoice', {
        status: response.status,
        invoiceId,
        errorData,
      });
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    return data;
  } catch (error) {
    logger.error('Error canceling invoice', { error, invoiceId });
    return null;
  }
}

/**
 * Get receipt for an invoice
 * Documentation: https://monobank.ua/api-docs/acquiring/methods/ia/get--api--merchant--invoice--receipt
 */
export async function getInvoiceReceipt(
  invoiceId: string
): Promise<Record<string, unknown> | null> {
  if (!paymentConfig.plataApiKey) {
    logger.warn('Monobank API key not configured, cannot fetch receipt');
    return null;
  }

  try {
    const response = await fetch(
      `https://api.monobank.ua/api/merchant/invoice/receipt?invoiceId=${encodeURIComponent(invoiceId)}`,
      {
        method: 'GET',
        headers: {
          'X-Token': paymentConfig.plataApiKey,
        },
      }
    );

    if (!response.ok) {
      logger.error('Failed to fetch invoice receipt', {
        status: response.status,
        invoiceId,
      });
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    return data;
  } catch (error) {
    logger.error('Error fetching invoice receipt', { error, invoiceId });
    return null;
  }
}

export default {
  getPublicKey,
  getInvoiceStatus,
  cancelInvoice,
  getInvoiceReceipt,
};
