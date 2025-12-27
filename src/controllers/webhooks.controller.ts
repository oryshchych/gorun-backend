import crypto from 'crypto';
import { Request, Response } from 'express';
import { frontendConfig, paymentConfig } from '../config/env';
import { logger } from '../config/logger';
import { Event } from '../models/Event';
import emailService from '../services/email.service';
import paymentsService from '../services/payments.service';
import registrationsService from '../services/registrations.service';
import { plataWebhookSchema } from '../validators/webhooks.validator';

/**
 * Verify webhook signature using ECDSA
 * Documentation: https://monobank.ua/api-docs/acquiring/dev/webhooks/verify
 */
const verifySignature = (rawBody: string, signatureHeader?: string): boolean => {
  // If no public key configured, skip verification (for development)
  if (!paymentConfig.plataWebhookPublicKey) return true;
  if (!signatureHeader) return false;

  try {
    // Decode base64 signature
    const signature = Buffer.from(signatureHeader, 'base64');

    // Public key is base64-encoded PEM format
    // Decode from base64 to get PEM string, then convert to Buffer
    const publicKeyPem = Buffer.from(paymentConfig.plataWebhookPublicKey, 'base64').toString(
      'utf-8'
    );
    const publicKeyBuffer = Buffer.from(publicKeyPem, 'utf-8');

    // Create verify object
    const verify = crypto.createVerify('SHA256');
    verify.write(rawBody);
    verify.end();

    // Verify signature using ECDSA public key
    return verify.verify(publicKeyBuffer, signature);
  } catch (error) {
    logger.error('Webhook signature verification failed', { error });
    return false;
  }
};

export const handlePlataWebhook = async (req: Request, res: Response): Promise<void> => {
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);

  if (!verifySignature(rawBody, req.headers['x-sign'] as string | undefined)) {
    res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    return;
  }

  const payload = await plataWebhookSchema.parseAsync(req.body);
  const invoiceId = payload.invoiceId;

  if (!invoiceId) {
    res.status(400).json({ success: false, message: 'invoiceId is required' });
    return;
  }

  const payment = await paymentsService.findByInvoiceId(invoiceId);
  if (!payment) {
    res.status(404).json({ success: false, message: 'Payment not found' });
    return;
  }

  // Monobank statuses: 'created', 'processing', 'success', 'failure', 'expired', 'hold'
  // Only 'success' means payment is completed
  const isSuccess = payload.status === 'success';

  try {
    const registration = isSuccess
      ? await registrationsService.markPaymentCompleted(
          payment,
          payload.paymentId,
          payload as Record<string, unknown>
        )
      : await registrationsService.markPaymentFailed(payment, payload as Record<string, unknown>);

    const event = await Event.findById(registration.eventId).lean();

    if (isSuccess && registration.email && event) {
      void emailService.sendRegistrationConfirmation({
        to: registration.email,
        name: `${registration.name ?? ''} ${registration.surname ?? ''}`.trim() || 'Participant',
        eventTitle: event.title,
        eventDate: event.date.toISOString(),
        eventLocation: event.location,
        paymentAmount: payment.amount,
        paymentCurrency: payment.currency,
        registrationId: registration.id,
      });
    } else if (!isSuccess && registration.email && event) {
      const retryLink = `${frontendConfig.failureUrl}?registrationId=${registration.id}`;
      void emailService.sendPaymentFailed({
        to: registration.email,
        name: `${registration.name ?? ''} ${registration.surname ?? ''}`.trim() || 'Participant',
        eventTitle: event.title,
        retryLink,
        errorMessage: 'Payment was declined',
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Failed to process Monobank webhook', { error });
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
