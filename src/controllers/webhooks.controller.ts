import crypto from 'crypto';
import { Request, Response } from 'express';
import { eventConfig, frontendConfig, paymentConfig } from '../config/env';
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
  const signatureHeader = req.headers['x-sign'] as string | undefined;

  logger.info('Received Monobank webhook', {
    hasSignature: !!signatureHeader,
    bodyKeys: Object.keys(req.body || {}),
    invoiceId: (req.body as { invoiceId?: string })?.invoiceId,
    status: (req.body as { status?: string })?.status,
  });

  if (!verifySignature(rawBody, signatureHeader)) {
    logger.error('Webhook signature verification failed', {
      hasSignature: !!signatureHeader,
      invoiceId: (req.body as { invoiceId?: string })?.invoiceId,
    });
    res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    return;
  }

  let payload;
  try {
    payload = await plataWebhookSchema.parseAsync(req.body);
  } catch (error) {
    logger.error('Webhook payload validation failed', {
      error,
      body: req.body,
    });
    res.status(400).json({ success: false, message: 'Invalid webhook payload' });
    return;
  }

  const invoiceId = payload.invoiceId;

  if (!invoiceId) {
    logger.error('Webhook missing invoiceId', { payload });
    res.status(400).json({ success: false, message: 'invoiceId is required' });
    return;
  }

  logger.info('Processing webhook for invoice', {
    invoiceId,
    status: payload.status,
    paymentId: payload.paymentId,
  });

  const payment = await paymentsService.findByInvoiceId(invoiceId);
  if (!payment) {
    logger.error('Payment not found for invoice', { invoiceId });
    res.status(404).json({ success: false, message: 'Payment not found' });
    return;
  }

  logger.info('Found payment for webhook', {
    paymentId: payment._id.toString(),
    currentStatus: payment.status,
    registrationId: payment.registrationId,
    newStatus: payload.status,
  });

  // Monobank statuses: 'created', 'processing', 'success', 'failure', 'expired', 'hold'
  // Only 'success' means payment is completed
  const isSuccess = payload.status === 'success';

  // Skip processing if payment is already in the target state
  if (isSuccess && payment.status === 'completed') {
    logger.info('Payment already completed, skipping webhook processing', {
      paymentId: payment._id.toString(),
      invoiceId,
    });
    res.status(200).json({ success: true, message: 'Payment already processed' });
    return;
  }

  if (!isSuccess && payment.status === 'failed') {
    logger.info('Payment already marked as failed, skipping webhook processing', {
      paymentId: payment._id.toString(),
      invoiceId,
    });
    res.status(200).json({ success: true, message: 'Payment already processed' });
    return;
  }

  try {
    const registration = isSuccess
      ? await registrationsService.markPaymentCompleted(
          payment,
          payload.paymentId,
          payload as Record<string, unknown>
        )
      : await registrationsService.markPaymentFailed(payment, payload as Record<string, unknown>);

    logger.info('Webhook processed successfully', {
      paymentId: payment._id.toString(),
      registrationId: registration.id,
      status: payload.status,
      isSuccess,
    });

    const event = await Event.findById(registration.eventId).lean();

    if (isSuccess && registration.email && event) {
      // Calculate price breakdown for email
      const eventBasePrice = event.basePrice ?? eventConfig.basePrice;
      const registrationFinalPrice = registration.finalPrice ?? payment.amount;
      const discountAmount =
        eventBasePrice && registrationFinalPrice < eventBasePrice
          ? eventBasePrice - registrationFinalPrice
          : 0;

      const emailParams: Parameters<typeof emailService.sendRegistrationConfirmation>[0] = {
        to: registration.email,
        name: `${registration.name ?? ''} ${registration.surname ?? ''}`.trim() || 'Participant',
        eventTitle: event.title,
        eventDate: event.date.toISOString(),
        eventLocation: event.location,
        paymentAmount: registrationFinalPrice,
        paymentCurrency: payment.currency,
        registrationId: registration.id,
        basePrice: eventBasePrice,
      };

      if (discountAmount > 0) {
        emailParams.discountAmount = discountAmount;
      }
      if (registration.promoCode) {
        emailParams.promoCode = registration.promoCode;
      }

      void emailService.sendRegistrationConfirmation(emailParams);
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
    logger.error('Failed to process Monobank webhook', {
      error,
      paymentId: payment._id.toString(),
      invoiceId,
      status: payload.status,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
