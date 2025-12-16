import crypto from 'crypto';
import { Request, Response } from 'express';
import { frontendConfig, paymentConfig } from '../config/env';
import { logger } from '../config/logger';
import { Event } from '../models/Event';
import emailService from '../services/email.service';
import paymentsService from '../services/payments.service';
import registrationsService from '../services/registrations.service';
import { plataWebhookSchema } from '../validators/webhooks.validator';

const verifySignature = (rawBody: string, signatureHeader?: string): boolean => {
  if (!paymentConfig.plataWebhookSecret) return true;
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac('sha256', paymentConfig.plataWebhookSecret)
    .update(rawBody)
    .digest('hex');

  return expected === signatureHeader;
};

export const handlePlataWebhook = async (req: Request, res: Response): Promise<void> => {
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);

  if (!verifySignature(rawBody, req.headers['x-signature'] as string | undefined)) {
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
    logger.error('Failed to process Plata webhook', { error });
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
